import React, { Component } from 'react';
import axios from 'axios';
import {
Col,
FormGroup,
Label,
Input,
} from "reactstrap";

const API_GATEWAY_ID = process.env.REACT_APP_API_PATH;
const SOCKET_API_GATEWAY_ID = process.env.REACT_APP_SOCKET_API_PATH;
var moment = require('moment');

export default class ImageRecognition extends Component {
constructor(props) {
super(props);
this.state = {
session_id: moment().valueOf(),
type: "",
totalPartNum: 0,
currentPartnum: 0,
description: "",
number_of_people: 0,
files: [],
isLoading: false,
mode: "stream",
};
}


onValueChanged = (name, value) => {
    let obj = {};
    obj[name] = value;
    this.setState(obj);
};

readFileAsync = (file) => {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

closeWebSocket = () => {
    if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
    }
    if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
    }
};

onMessageReceived = async (message) => {
    if (this.state.mode === "stream") {
        const src_key = message.src_key;
        this.setState({ image_url: message.image_url });
        this.streamResponse(src_key);
    } else {
        this.setState({ description: message.description, number_of_people: message.number_of_people, image_url: message.image_url, isLoading: false });
    }
};

streamResponse = async (src_key) => {
    const that = this;
    const url = `${process.env.REACT_APP_STREAM_PATH}?src_key=${src_key}`;
    const response = await fetch(url);
    const reader = response.body.getReader();
    let received = that.state.description;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder("utf-8").decode(value, { stream: true });
        received = that.state.description += chunk.toString();
        const arr = received.split("###");

        if (arr.length === 2 && arr[1] !== '') {
            that.setState({ description: arr[0], number_of_people: arr[1] });
        } else {
            that.setState({ description: received, isLoading: false });
        }
    }
};

connectToWebSocket = () => {
    const that = this;
    const address = `${SOCKET_API_GATEWAY_ID}?session_id=${this.state.session_id}`;
    this.websocket = new WebSocket(address);

    this.websocket.onopen = (response) => {
        console.log(response);
        this.timer = setInterval(() => {
            this.websocket.send(JSON.stringify({ message: "ping" }));
        }, 3 * 1000);
    };

    this.websocket.onmessage = (message) => {
        let obj = JSON.parse(message.data);
        if (obj.type === "ping") {
            that.setState({ connection_id: obj.connection_id });
        } else {
            this.onMessageReceived(obj);
        }
    };

    this.websocket.onclose = (event) => {
        console.log("onclose");
        if (this.timer || this.websocket) this.closeWebSocket();
    };

    this.websocket.onerror = (event) => {
        console.error("WebSocket error observed:", event);
        if (this.timer || this.websocket) this.closeWebSocket();
    };
};

componentDidMount = async () => {
    this.connectToWebSocket();
};

handleSubmit = async () => {
    const fileArray = this.state.files;
    const session_id = this.state.session_id;
    if (fileArray.length < 1) {
        alert("파일을 선택해주세요");
        return;
    }

    this.setState({ totalPartNum: fileArray.length, isLoading: true, description: "", number_of_people: 0, image_url: "" });
    let cnt = 0;
    for await (const file of fileArray) {
        try {
            const s3SignedUrlData = await axios({
                method: 'GET',
                url: `${API_GATEWAY_ID}/image/upload/singlepart`,
                params: {
                    size: file.size,
                    org_file_name: file.name,
                    mode: "stream",
                    session_id: session_id
                }
            });

            const url = s3SignedUrlData.data.url;
            const _axios = axios.create();
            delete _axios.defaults.headers.put['Content-Type'];

            await _axios.put(url, file);
            this.setState({ currentPartnum: cnt++ });
        } catch (e) {
            this.setState({ isLoading: false });
            alert("알 수 없는 오류입니다.");
            console.log(e);
        }
    }
};

render() {
    return (
        <div>
            {this.state.isLoading && <div className="loading-overlay"></div>}
            <h3>이미지 분석</h3>
            <FormGroup row>
                <Col sm={12}>
                    <Input
                        id="exampleFile"
                        name="file"
                        type="file"
                        multiple={false}
                        onChange={(e) => {
                            const files = e.target.files;
                            this.setState({ files: files });
                        }}
                    />
                </Col>
            </FormGroup>

            <div className="d-grid">
                <button type="submit" className="btn btn-primary" onClick={() => { this.handleSubmit() }}>
                    업로드
                </button>
            </div>
            <FormGroup row>
                <Label for="engine_type" sm={6}>
                    이미지
                </Label>
                <Col sm={12}>
                    <img src={this.state.image_url} alt="" style={{ width: "100%" }} />
                </Col>
            </FormGroup>
            <FormGroup row>
                <Label for="engine_type" sm={6}>
                    분석결과
                </Label>
                <Col sm={12}>
                    <textarea
                        id="description"
                        name="description"
                        type="text"
                        style={{ width: "100%", height: "300px" }}
                        disabled={true}
                        value={this.state.description}
                    />
                </Col>
            </FormGroup>
            <FormGroup row>
                <Label for="engine_type" sm={6}>
                    사람 숫자
                </Label>
                <Col sm={12}>
                    <Input
                        id="number_of_people"
                        name="number_of_people"
                        type="text"
                        style={{ width: "100%" }}
                        disabled={true}
                        value={this.state.number_of_people}
                    />
                </Col>
            </FormGroup>
            <a style={{ fontWeight: 800, color: "red" }}>
                {this.state.currentPartnum > 0 ? `업로드중 : ${this.state.currentPartnum}/${this.state.totalPartNum}` : ""}
            </a>
        </div>
 );
}
}