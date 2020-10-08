import React from "react";
import styles from "./style";

import { WithStyles, withStyles } from "@material-ui/core";
import ExpansionPanel from "@material-ui/core/ExpansionPanel";
import ExpansionPanelDetails from "@material-ui/core/ExpansionPanelDetails";
import ExpansionPanelSummary from "@material-ui/core/ExpansionPanelSummary";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";

import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import AttachmentIcon from "@material-ui/icons/Attachment";
import { IThreadAttach } from "../Editor";

interface Props extends WithStyles {
    fileList: Array<IThreadAttach>;

    onRemove: (item: IThreadAttach) => void;
    onChange: (list: Array<IThreadAttach>, changedItem: IThreadAttach) => void;
    onInsertImage: (aid: string) => void;
}

let abortList: { [key: string]: () => void } = {};

export const MAX_UPLOAD_FILE_SIZE = 1 * 1024 * 1024;
export const MAX_UPLOAD_AVATAR_SIZE = 200 * 1024;
export const MAX_UPLOAD_PER_REQUEST = 10;

export const upload = (tempId: string, url: string, { method, headers, body }: RequestInit, onProgress?: XMLHttpRequestEventTarget["onprogress"]) =>
    new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method || "get", url);
        headers && Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.setRequestHeader("Authorization", localStorage.getItem("token")!);
        xhr.onload = function () {
            delete abortList[tempId];
            resolve(this.responseText);
        };
        xhr.onerror = function () {
            delete abortList[tempId];
            reject();
        };
        if (onProgress) {
            xhr.upload.onprogress = onProgress;
        }
        xhr.send(body);

        abortList[tempId] = () => xhr.abort();
    });

export const abortAll = () => {
    Object.entries(abortList).forEach(([_k, v]) => {
        try {
            v();
        } catch (e) {
            console.log(e);
        }
    });
    abortList = {};
};

export const abortOne = (tempId: string) => {
    try {
        const result = Object.entries(abortList).filter(([k, v]) => k === tempId);
        if (result.length === 1) {
            const [[, abortObj]] = result;
            abortObj();

            abortList = Object.entries(abortList).reduce((p, [k, v]) => {
                if (k !== tempId) {
                    return {
                        ...p,
                        [k]: v
                    };
                } else {
                    return p;
                }
            }, {});
        }
    } catch (e) {
        console.log(e);
    }
};

export const SUPPORT_IMAGE_PREVIEW_SUFFIX = ["jpg", "jpeg", "png", "gif", "bmp"];

export interface IUploadingItem {
    file: File;
    progress: number;
    tempId: string;
}

class UserPostList extends React.Component<Props> {
    state = {
        expanded: false as boolean | string,
        uploadingList: [] as Array<IUploadingItem>
    };

    componentWillUnmount() {
        abortAll();
    }
    componentDidMount() {
        abortAll();
    }

    handleExpandPanel = (panel: string) => (_e: React.ChangeEvent<{}>, isExpanded: boolean) => {
        this.setState({
            expanded: isExpanded ? panel : false
        });
    };
    handleChangeNumber = (aid: string, key: "credits" | "creditsType") => (event: React.ChangeEvent<HTMLInputElement>) => {
        const { onChange, fileList } = this.props;

        const [newFileList, [changedItem]] = fileList.reduce(
            (p, item) => {
                if (aid === item.aid) {
                    const newObj = {
                        ...item,
                        [key]: Number.parseInt(event.target.value)
                    };
                    p[1].push(newObj);
                    p[0].push(newObj);
                } else {
                    p[0].push(item);
                }

                return p;
            },
            [[], []] as [Array<IThreadAttach>, Array<IThreadAttach>]
        );

        onChange(newFileList, changedItem);
    };
    handleRemove = (aid: string) => () => {
        const { onRemove, onChange, fileList } = this.props;

        const [newList, [targetItem]] = fileList.reduce(
            (p, item) => {
                if (item.aid === aid) {
                    p[1].push(item);
                } else {
                    p[0].push(item);
                }
                return p;
            },
            [[], []] as [Array<IThreadAttach>, Array<IThreadAttach>]
        );

        onRemove(targetItem);
        onChange(newList, targetItem);
    };
    handleUploadStart = ({ target: { files } }: React.ChangeEvent<HTMLInputElement>) => {
        if (files) {
            const addedItem: Array<IUploadingItem> = [];
            // check if file valid
            if (files.length > MAX_UPLOAD_PER_REQUEST) {
                alert("每次最多只能上传" + MAX_UPLOAD_PER_REQUEST + "个文件！");
                return;
            }

            for (let i = 0; i < files.length; i++) {
                if (files[i].size > MAX_UPLOAD_FILE_SIZE) {
                    alert("单个文件最大" + MAX_UPLOAD_FILE_SIZE / 1024 / 1024 + "MB！");
                    continue;
                }
                addedItem.push({
                    tempId: "T" + new Date().getTime().toString() + i.toString(),
                    file: files[i],
                    progress: 0
                });
            }
            // upload logics
            this.setState({
                uploadingList: [...this.state.uploadingList, ...addedItem]
            });

            for (let i = 0; i < addedItem.length; i++) {
                const { file, tempId } = addedItem[i];
                const formData = new FormData();
                formData.append("attach", file);
                const promise = upload(
                    tempId,
                    `https://fake_url/`,
                    {
                        method: "POST",
                        body: formData
                    },
                    event => {
                        const { uploadingList: oldList } = this.state;
                        this.setState({
                            uploadingList: oldList.map(item => {
                                if (item.tempId === tempId) {
                                    return { ...item, progress: ((event.loaded / event.total) * 100).toFixed(2) };
                                } else {
                                    return item;
                                }
                            })
                        });
                    }
                );

                promise.then(
                    (response: string) => {
                        const { code, message } = JSON.parse(response);
                        const { uploadingList: oldList } = this.state;
                        if (code === 200) {
                            this.setState({
                                uploadingList: oldList.filter(item => item.tempId !== tempId)
                            });
                            const { onChange, fileList } = this.props;
                            const attachObj = { ...message, creditsType: 0, credits: 0 };
                            onChange([...fileList, attachObj], attachObj);
                        } else {
                            alert(message);
                        }
                    },
                    reason => {
                        const { uploadingList: oldList } = this.state;
                        this.setState({
                            uploadingList: oldList.filter(item => item.tempId !== tempId)
                        });
                        alert(reason.toString());
                    }
                );
            }
        }
    };
    handleUploadBtnClick = () => {
        if (this.uploadElementRef) {
            this.uploadElementRef.click();
        }
    };
    handleUpdate = (aid: string) => () => {
        this.uploadUpdateAid = aid;
        if (this.uploadUpdateElementRef) {
            this.uploadUpdateElementRef.click();
        }
    };
    handleUploadUpdateStart = ({ target: { files } }: React.ChangeEvent<HTMLInputElement>) => {
        const aid = this.uploadUpdateAid;
        if (aid && files && files.length === 1) {
            const file = files[0];
            const tempId = `Update${aid}`;

            if (file.size > MAX_UPLOAD_FILE_SIZE) {
                alert("单个文件最大" + MAX_UPLOAD_FILE_SIZE / 1024 / 1024 + "MB！");
                return;
            }

            const [currentObj] = this.props.fileList.filter(item => item.aid === aid);
            const addedItem = {
                tempId,
                file,
                progress: 0
            };

            this.setState({
                uploadingList: [...this.state.uploadingList, addedItem]
            });

            const formData = new FormData();
            formData.append("attach", file);
            const promise = upload(
                tempId,
                `https://fake_url/${aid}`,
                {
                    method: "POST",
                    body: formData
                },
                event => {
                    const { uploadingList: oldList } = this.state;
                    this.setState({
                        uploadingList: oldList.map(item => {
                            if (item.tempId === tempId) {
                                return { ...item, progress: ((event.loaded / event.total) * 100).toFixed(2) };
                            } else {
                                return item;
                            }
                        })
                    });
                }
            );

            promise.then(
                (response: string) => {
                    const { code, message } = JSON.parse(response);
                    const { uploadingList: oldList } = this.state;
                    if (code === 200) {
                        const [[targetObj], newUploadingList] = oldList.reduce(
                            (p, cur) => {
                                if (cur.tempId === tempId) {
                                    p[0].push(cur);
                                } else {
                                    p[1].push(cur);
                                }
                                return p;
                            },
                            [[] as Array<IUploadingItem>, [] as Array<IUploadingItem>]
                        );

                        this.setState({
                            uploadingList: newUploadingList
                        });

                        const { onChange, fileList } = this.props;
                        const attachObj = { ...message };
                        onChange(
                            [
                                ...fileList.map(item => {
                                    if (item.aid === attachObj.aid) {
                                        return attachObj;
                                    } else {
                                        return item;
                                    }
                                })
                            ],
                            attachObj
                        );
                    } else {
                        alert(message);
                    }
                },
                reason => {
                    alert(reason.toString());
                }
            );
        }
    };
    handleAbort = (tempId: string) => () => {
        const { uploadingList: oldList } = this.state;
        this.setState({
            uploadingList: oldList.filter(item => item.tempId !== tempId)
        });
        abortOne(tempId);
    };
    handleInsertImage = (aid: string) => () => {
        const { onInsertImage } = this.props;
        onInsertImage(aid);
    };
    renderInsertImage = (item: IThreadAttach) => {
        const { classes } = this.props;
        const splitedArr = item.originalName.split(".");
        if (splitedArr.length <= 0) {
            return <></>;
        }
        const suffix = splitedArr[splitedArr.length - 1].toLowerCase();

        if (splitedArr.length >= 2 && SUPPORT_IMAGE_PREVIEW_SUFFIX.includes(suffix)) {
            return (
                <Button variant="contained" color="primary" className={classes.button} size="medium" onClick={this.handleInsertImage(item.aid)}>
                    插入
                </Button>
            );
        } else {
            return <></>;
        }
    };
    uploadElementRef: HTMLInputElement | null = null;
    uploadUpdateElementRef: HTMLInputElement | null = null;
    uploadUpdateAid: string | null = null;
    render() {
        const { classes, fileList } = this.props;
        const { expanded, uploadingList } = this.state;

        return (
            <div className={classes["upload-container"]}>
                <div className={classes["upload-btn"]}>
                    <input
                        type="file"
                        onChange={this.handleUploadStart}
                        id="fileUpload"
                        className={classes.none}
                        multiple
                        ref={elem => (this.uploadElementRef = elem)}
                    />
                    <input
                        type="file"
                        onChange={this.handleUploadUpdateStart}
                        id="fileUpdate"
                        className={classes.none}
                        ref={elem => (this.uploadUpdateElementRef = elem)}
                    />
                    <Button variant="contained" color="primary" className={classes.button} size="small" onClick={this.handleUploadBtnClick}>
                        上传文件
                    </Button>
                </div>
                <div className={classes["upload-list"]}>
                    {fileList.map(item => (
                        <ExpansionPanel expanded={expanded === item.aid} onChange={this.handleExpandPanel(item.aid)} key={item.aid}>
                            <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography className={classes.heading}>
                                    <AttachmentIcon className={classes["attach-icon"]} />
                                    {item.originalName}
                                </Typography>
                                <Typography className={classes.secondaryHeading}>{(item.fileSize / 1024).toFixed(2)} KB</Typography>
                            </ExpansionPanelSummary>
                            <ExpansionPanelDetails className={classes["detail-container"]}>
                                <div className={classes["delete-btn-container"]}>
                                    {this.renderInsertImage(item)}
                                    <Button variant="contained" color="primary" className={classes.button} size="medium" onClick={this.handleUpdate(item.aid)}>
                                        更新
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        className={classes.button}
                                        size="medium"
                                        onClick={this.handleRemove(item.aid)}
                                    >
                                        删除
                                    </Button>
                                </div>
                            </ExpansionPanelDetails>
                        </ExpansionPanel>
                    ))}
                </div>
                <div className={classes["uploading-list"]}>
                    {uploadingList.map(item => (
                        <ExpansionPanel expanded={expanded === item.tempId} onChange={this.handleExpandPanel(item.tempId)} key={item.tempId}>
                            <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography className={classes.heading}>{item.file.name}</Typography>
                                <Typography className={classes.secondaryHeading}>
                                    {item.progress}%, 共计{(item.file.size / 1024).toFixed(2)} KB
                                </Typography>
                            </ExpansionPanelSummary>
                            <ExpansionPanelDetails>
                                <div className={classes["delete-btn-container"]}>
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        className={classes.button}
                                        size="small"
                                        onClick={this.handleAbort(item.tempId)}
                                    >
                                        终止
                                    </Button>
                                </div>
                            </ExpansionPanelDetails>
                        </ExpansionPanel>
                    ))}
                </div>
            </div>
        );
    }
}

export default withStyles(styles)(UserPostList);
