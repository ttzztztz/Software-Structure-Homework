import React from "react";
import styles from "./style";
import clsx from "clsx";

import BraftEditor from "braft-editor";

import { AppBar, Toolbar, WithStyles, withStyles } from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import Fab from "@material-ui/core/Fab";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import MessageIcon from "@material-ui/icons/Message";
import Upload from "./Upload";

interface Props extends WithStyles { }

export interface IThreadAttach {
    aid: string;
    fileSize: number;
    downloads: number;
    originalName: string;
    createDate: Date;

    needBuy?: boolean;
}

class Post extends React.PureComponent<Props> {
    autoSave: null | NodeJS.Timeout = null;

    async componentDidMount() {
        const message = '', subject = 'Subject';

        this.setState({
            message,
            subject,
            editorState: BraftEditor.createEditorState(message)
        });

        this.autoSave = setInterval(() => {
            const { message } = this.state;
            localStorage && localStorage.setItem("temp", message);
        }, 5000);
    }
    componentWillUnmount() {
        this.autoSave && clearInterval(this.autoSave);
        this.autoSave = null;
    }

    state = {
        subject: "",
        message: "",
        attach: [] as Array<IThreadAttach>,
        editorState: BraftEditor.createEditorState("<div></div>"),
    };

    handleChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        this.setState({
            [key]: e.target.value
        });
    };
    handleContentChange = (editorState: any) => {
        this.setState({
            editorState,
            message: editorState.toHTML()
        });
    };
    showAlerts = (message: string) => {
        alert(message);
    };

    save = () => {
        const { subject, message } = this.state;
        localStorage.setItem('memo', JSON.stringify({ subject, message }));
    };
    handleSubmitClick = async () => {
        this.save();
    };
    renderEditor = () => {
        const { classes } = this.props;
        const { editorState } = this.state;
        const excludeControls: any = ["media", "clear"];

        return (
            <BraftEditor
                id="editor-with-code-highlighter"
                value={editorState}
                onChange={this.handleContentChange}
                className={classes["post-content"]}
                excludeControls={excludeControls}
            />
        );
    };
    renderAttach = () => {
        const handleRemove = async (item: IThreadAttach) => {

        };
        const handleChange = (list: IThreadAttach[], _changedItem: IThreadAttach) => {
            this.setState({
                attach: list
            });
        };

        const { attach } = this.state;
        const { classes } = this.props;
        return (
            <div className={classes["attach-container"]}>
                <Upload fileList={attach} onRemove={handleRemove} onChange={handleChange} onInsertImage={() => { }} />
            </div>
        );
    };

    render() {
        const { classes } = this.props;
        const { subject: title } = this.state;
        const renderForum = ["分类A", "分类B"];
        return (
            <>
                <AppBar position="static">
                    <Toolbar>
                        <Typography variant="h6" className={classes.title}>
                            编辑器
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Paper className={classes.root}>
                    <div className={classes["title-container"]}>
                        <TextField
                            id="forum"
                            select
                            label="分类"
                            className={classes["post-forum"]}
                            onChange={this.handleChange("fid")}
                            SelectProps={{
                                MenuProps: {
                                    className: classes.menu
                                }
                            }}
                            margin="dense"
                            variant="outlined"
                        >
                            {renderForum.map(item => (
                                <MenuItem key={item} value={item}>
                                    {item}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            id="title"
                            label="标题"
                            className={classes["post-title"]}
                            value={title}
                            onChange={this.handleChange("subject")}
                            margin="dense"
                            variant="outlined"
                        />
                    </div>
                    <div className={classes["content-container"]}>{this.renderEditor()}</div>
                    {this.renderAttach()}
                    <div className={classes["btn-container"]}>
                        <Fab
                            variant="extended"
                            size="medium"
                            color="primary"
                            aria-label="add"
                            className={clsx(classes.button, classes.submit)}
                            onClick={this.handleSubmitClick}
                        >
                            <MessageIcon className={clsx(classes["btn-icon"], classes["submit-icon"])} />
                            保存
                        </Fab>
                    </div>
                </Paper>
            </>
        );
    }
}

export default withStyles(styles)(Post);
