"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const EnvSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    OPENAI_API_KEY: zod_1.z.string().min(1),
    OPENAI_MODEL: zod_1.z.string().min(1).default("gpt-5.4-mini"),
    OPENAI_MODERATION_MODEL: zod_1.z.string().min(1).default("omni-moderation-latest"),
    LOG_LEVEL: zod_1.z.string().min(1).default("info"),
    IMAGE_FETCH_REDIRECT_LIMIT: zod_1.z.coerce.number().int().min(0).default(3),
    IMAGE_FETCH_MAX_CONTENT_LENGTH_BYTES: zod_1.z.coerce.number().int().positive().default(10 * 1024 * 1024),
    IMAGE_FETCH_CONNECT_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(2_000),
    IMAGE_FETCH_READ_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(5_000),
});
const env = EnvSchema.parse(process.env);
exports.env = env;
