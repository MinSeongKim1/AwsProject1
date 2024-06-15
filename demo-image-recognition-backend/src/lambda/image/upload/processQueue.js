const { DynamoDBClient, PutItemCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } = require("@aws-sdk/client-apigatewaymanagementapi");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");

const { handleLambdaEvent } = require("slsberry");
const ddbUtil = require('../../lib/ddbUtil.js');
const apiSpec = {
    category: "Request",
    event: [
        {
            type: "sqs",
            sqs: `ImageSQSQueue`,
            batchSize: 1,
        },
    ],
    desc: "이미지 업로드시 처리",
    parameters: {},
    responses: {
        description: "",
    },
    timeout: 300,
};
exports.apiSpec = apiSpec;

//유저에게 메시지 전송
async function sendMessage(session_id, item) {
    const dynamoDBClient = new DynamoDBClient({ region: "ap-northeast-2" });
    const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

    //우선 기록을 남기고,
    await ddbUtil.put(docClient, 'descriptions', item);

    //웹소켓에 연결된 유저 목록 중 해당 세션에 연결된 유저를 가져와서
    const userResult = await ddbUtil.query(docClient, "userlist", ["session_id"], [session_id], { IndexName: 'session_id-index' });

    if (userResult.Items) {
        const apigwManagementApi = new ApiGatewayManagementApiClient({
            apiVersion: '2018-11-29',
            region: process.env.region,
            endpoint: `https://${process.env.socket_api_gateway_id}.execute-api.${process.env.region}.amazonaws.com/${process.env.stage}-${process.env.version}`
        });

        //유저에게 메시지 전송
        const postCalls = userResult.Items.map(async ({ connection_id }) => {
            console.log(connection_id);
            const dt = { ConnectionId: connection_id, Data: JSON.stringify(item) };
            try {
                await apigwManagementApi.send(new PostToConnectionCommand(dt));
            } catch (e) {
                console.log(e);

                if (e instanceof GoneException) {
                    //연결이 끊긴 유저라면, 유저 목록에서 삭제
                    console.log(`Found stale connection, deleting ${connection_id}`);
                    await ddbUtil.doDelete(docClient, "chat-userlist", { "connection_id": connection_id });
                } else {
                    console.error("Error sending message:", e);
                }
            }
        });

        try {
            await Promise.all(postCalls);
        } catch (e) {
            return { statusCode: 500, body: e.stack };
        }
    }
}

async function handler(event, context) {
    console.log(event);

    const messageBody = JSON.parse(event.Records[0].body);
    if (messageBody.Event === "s3:TestEvent") {
        return {
            status: 200,
            response: {
                result: "success"
            }
        };
    }

    //S3 버킷 이름과 키를 추출
    const srcBucket = messageBody.Records[0].s3.bucket.name;
    const srcKey = decodeURIComponent(messageBody.Records[0].s3.object.key.replace(/\+/g, " "));

    const publicUrl = `https://${srcBucket}.s3.amazonaws.com/${encodeURIComponent(srcKey)}`;
    console.log(publicUrl);

    const s3Client = new S3Client({ region: process.env.region });
    const params = {
        Bucket: srcBucket,
        Key: srcKey
    };
    //메타데이터 추출
    const command = new HeadObjectCommand(params);
    const metadataResponse = await s3Client.send(command);
    const metadata = metadataResponse.Metadata;
    console.log(metadata);
    const session_id = metadata.session_id;

    try {
        // 스트리밍 모드에서 이미지 전송
        await sendMessage(session_id, { src_key: srcKey, image_url: publicUrl });
    } catch (e) {
        console.log(e);
        await sendMessage(session_id, { description: "오류가 발생했습니다", image_url: publicUrl });
        return {
            status: 500,
            response: {
                error: {
                    code: 'unexpected_error',
                    message: '알 수 없는 에러',
                },
            },
        };
    }
}

exports.handler = async (event, context) => {
    return await handleLambdaEvent(event, context, apiSpec, handler);
};
