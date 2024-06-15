
const { DynamoDBClient, PutItemCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const Readable = require('stream').Readable
const ddbUtil = require('../lib/ddbUtil.js');
exports.handler = awslambda.streamifyResponse(
    async (event, responseStream, context) => {


        //S3 정보
        const bucket = process.env.file_bucket_name;
        const key = event.queryStringParameters.src_key;
        const publicUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
        const httpResponseMetadata = {
            statusCode: 200,
            headers: {
                "Content-Type": "text/html;charset=UTF-8",
            }
        };
        console.log(JSON.stringify(event));

        // //응답 스트림 생성


        const chatgptAPIKey = process.env.CHATGPTAPIKEY
        try {
            //chatGPT -4o를 이용해서 이미지 설명 생성
            const { OpenAI } = require("openai");

            const prompt = `Please describe the image below in as much detail as possible in Korean. 
            Count the number of people visible in the image. Generate the answer in the format: description###number_of_people, each separated by "###". `
            const openai = new OpenAI({
                apiKey: chatgptAPIKey
            });
            const defaultModelParams = {
                max_tokens: 3000,
                temperature: 0.7,
                model_name: "gpt-4o",
            }
            const stream = await openai.chat.completions.create({
                model: defaultModelParams.model_name,
                max_tokens: defaultModelParams.max_tokens,
                temperature: defaultModelParams.temperature,
                stream: true,

                messages: [{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": publicUrl,
                            },
                        },

                    ],
                }]
            }, { responseType: 'stream' });
            let contents = "";
            //chatGPT의 응답을 스트림으로 받아서, 스트림을 읽어서, 유저에게 전송
            for await (const chunk of stream) {
                console.log(JSON.stringify(chunk));

                //{"id":"chatcmpl-8dXzveSdJXcxLJUkWvFaUM4773vYt","object":"chat.completion.chunk","created":1704436171,"model":"gpt-4-1106-vision-preview","choices":[{"delta":{"content":"}"},"index":0,"finish_reason":null}]}
                //끝났다면 분석을 DB에 넣고 종료
                if (chunk.choices[0].finish_reason == "stop") {
                    const dynamoDBClient = new DynamoDBClient({ region: "ap-northeast-2" });

                    const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
                    await ddbUtil.update(docClient, 'descriptions', { image_url: publicUrl }, ["description"], [contents])

                    responseStream.end();
                    break;

                }
                //아니라면, 유저에게 전송
                if (chunk.choices[0].delta.content) {
                    contents += chunk.choices[0].delta.content;
                    responseStream.write(chunk.choices[0].delta.content);

                }
            }

        } catch (e) {
            console.log(e);
            responseStream.write("오류가 발생했습니다.");
            responseStream.end();
        }

    }
);
