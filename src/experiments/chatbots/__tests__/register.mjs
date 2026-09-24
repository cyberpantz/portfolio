import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./src/experiments/chatbots/__tests__/ts-loader.mjs', pathToFileURL('./'));
