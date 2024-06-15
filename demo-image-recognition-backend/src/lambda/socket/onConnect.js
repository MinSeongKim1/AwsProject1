const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
var Base64 = require('js-base64').Base64;
var ddbUtil = require("../lib/ddbUtil");
var moment = require('moment');
var ddbUtil = require("../lib/ddbUtil");
const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 'chat',
    event: [
        {
            type: 'websocket',
            method: 'websocket',
            route: '$connect',
        },
    ],
    desc: '웹소켓 연결 처리.',
    parameters: {
        "session_id": { "req": true, "type": "String", "desc": "현재 채팅이 이루어진 방의 아이디" }
    },
    errors: {
        unexpected_error: { status_code: 500, reason: 'unexpected_error' },
    },
    responses: {
        description: '',
        content: 'application/json',
        schema: {
            type: 'object',
            properties: {
            },
        },
    },
}


exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const dynamoDBClient = new DynamoDBClient({
        region: "ap-northeast-2",
        credentials: event.v3TestProfile

    });
    const docClient = DynamoDBDocumentClient.from(dynamoDBClient);


    console.log(event);
    const { session_id } = inputObject;
    const item = {

        connection_id: event.requestContext.connectionId,
        session_id: session_id,
        timestamp: moment().valueOf()
    }
    try {
        await ddbUtil.put(docClient, 'userlist', item)

    } catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
    return {
        status: 200,
        response: {
            connection_id: event.requestContext.connectionId
        },
    };
};
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};
