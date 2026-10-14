import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Config } from "./platform/config.js";

export function buildApp(config: Config): FastifyInstance {
  return Fastify({
    logger: config.NODE_ENV === "test" ? false : { level: config.LOG_LEVEL },
  });
}
