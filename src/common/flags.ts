import { flags } from '@oclif/command';
import { IBooleanFlag } from '@oclif/parser/lib/flags';

export const help = (overrides: Partial<IBooleanFlag<boolean>> = {}) => ({
  help: flags.help({ char: 'h', ...overrides }),
});

export const servers = () => ({
  server: flags.string({
    char: 'S',
    description: 'override servers definition',
    helpValue: 'http://localhost:9000',
    multiple: true,
  }),
});

export const inject = () => ({
  inject: flags.string({
    char: 'I',
    description: 'inject JSON to definition with deep merge',
    helpValue: '{"info":{"version":"1.0.0"}}',
    multiple: true,
  }),
});

export const validate = () => ({
  validate: flags.boolean({ char: 'V', description: 'validate against openapi schema' }),
});

export const header = () => ({
  header: flags.string({ char: 'H', description: 'add request headers when calling remote urls', multiple: true }),
});

export const apiRoot = () => ({
  root: flags.string({ char: 'R', description: 'override API root path', helpValue: '/' }),
});

export const parseOpts = () => ({
  dereference: flags.boolean({ char: 'D', description: 'resolve $ref pointers' }),
  bundle: flags.boolean({ char: 'B', description: 'resolve remote $ref pointers' }),
  ...apiRoot(),
  ...header(),
  ...validate(),
  ...servers(),
  ...inject(),
});

export const serverOpts = () => ({
  port: flags.integer({
    char: 'p',
    description: 'port',
    default: 9000,
    helpValue: '9000',
  }),
  logger: flags.boolean({
    description: '[default: true] log requests',
    default: true,
    allowNo: true,
  }),
});

export const outputFormat = () => ({
  format: flags.enum({
    char: 'f',
    description: '[default: yaml] output format',
    options: ['json', 'yaml', 'yml'],
    exclusive: ['json', 'yaml'],
  }),
  json: flags.boolean({ description: 'format as json (short for -f json)', exclusive: ['format', 'yaml'] }),
  yaml: flags.boolean({ description: 'format as yaml (short for -f yaml)', exclusive: ['format', 'json'] }),
});

export const swaggerUIOpts = () => ({
  expand: flags.string({
    description: '[default: list] default expansion setting for the operations and tags',
    options: ['full', 'list', 'none'],
  }),
  operationids: flags.boolean({ description: '[default: true] display operationIds', default: true, allowNo: true }),
  filter: flags.boolean({ description: '[default: true] enable filtering by tag', default: true, allowNo: true }),
  deeplinks: flags.boolean({ description: '[default: true] allow deep linking', default: true, allowNo: true }),
  withcredentials: flags.boolean({
    description: '[default: true] send cookies in "try it now"',
    default: true,
    allowNo: true,
  }),
  requestduration: flags.boolean({
    description: '[default: true] display request durations in "try it now"',
    default: true,
    allowNo: true,
  }),
});

export const securityOpts = () => ({
  security: flags.string({ char: 's', description: 'use security scheme', multiple: true }),
  apikey: flags.string({ char: 'k', description: 'set api key' }),
  token: flags.string({ char: 't', description: 'set bearer token' }),
  username: flags.string({ char: 'u', description: 'set basic auth username' }),
  password: flags.string({ char: 'p', description: 'set basic auth password' }),
});
