/**
 * @author: youtube.com/@AWSClassroom
 */
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
var Base64 = require("js-base64").Base64;
const { handleHttpRequest } = require("slsberry");
const apiSpec = {
	category: "http",
	event: [
		{
			type: "REST",
			method: "Get",
		},
	],
	desc: "single presigned url들을 생성한다",
	parameters: {
		session_id: { req: true, type: "string", desc: "session_id" },
		org_file_name: { req: true, type: "string", desc: "원본 파일 이름름" },
		mode: { req: false, type: "string", desc: "stream 사용 여부" },
	},
	errors: {
		unexpected_error: { status_code: 500, reason: "알 수 없는 에러" },
	},
	responses: {
		description: "",
		content: "application/json",
		schema: {
			type: "object",
			properties: {
				hashKey: { type: "String", desc: "hash_key" },
			},
		},
	},
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
	//클라이언트에게 받은 파라미터
	const { session_id, org_file_name, mode } = inputObject;

	console.log(inputObject);

	try {
		//URL에 포함할 메타데이터
		let metadata = {
			"session_id": session_id,
			"mode": mode,
			"org_file_name": Base64.encode(org_file_name)
		};

		const s3Client = new S3Client({ region: "ap-northeast-2" });
		//Presigned URL 생성
		const putObjectParams = {
			Bucket: process.env.file_bucket_name,
			Key: org_file_name,
			Metadata: metadata
		};
		const presignedUrl = await getSignedUrl(s3Client, new PutObjectCommand(putObjectParams), { expiresIn: 6000 });


		return {
			status: 200,
			response: {
				result: "success",
				url: presignedUrl
			},
		};
	} catch (e) {
		console.log(e);
		return { predefinedError: apiSpec.errors.unexpected_error };
	}
}

exports.handler = async (event, context) => {
	return await handleHttpRequest(event, context, apiSpec, handler);
};