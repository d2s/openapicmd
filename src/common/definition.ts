import * as SwaggerParser from 'swagger-parser';
import { set, uniqBy } from 'lodash';
import * as YAML from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { Command } from '@oclif/command';
import { parseHeaderFlag } from './utils';

export const CONFIG_FILENAME = '.openapiconfig';

interface ParseOpts {
  definition: string;
  dereference?: boolean;
  validate?: boolean;
  bundle?: boolean;
  servers?: string[];
  header?: string[];
  root?: string;
  induceServers?: boolean;
}
export async function parseDefinition({
  definition,
  dereference,
  validate,
  bundle,
  servers,
  header,
  root,
  induceServers,
}: ParseOpts): Promise<SwaggerParser.Document> {
  let method = SwaggerParser.parse;
  if (bundle) {
    method = SwaggerParser.bundle;
  }
  if (dereference) {
    method = SwaggerParser.dereference;
  }
  if (validate) {
    method = SwaggerParser.validate;
  }

  const parserOpts: SwaggerParser.Options = {};

  // add headers
  if (header) {
    set(parserOpts, ['resolve', 'http', 'headers'], parseHeaderFlag(header));
  }

  const document = await method.bind(SwaggerParser)(definition, parserOpts);

  // add servers
  if (servers) {
    const serverObjects = servers.map((url) => ({ url }));
    document.servers = document.servers ? [...document.servers, ...serverObjects] : serverObjects;
  }

  // induce the remote server from the definition parameter if needed
  if ((induceServers && definition.startsWith('http')) || definition.startsWith('//')) {
    document.servers = document.servers || [];
    const inputURL = new URL(definition);
    const server = document.servers[0];
    if (!server) {
      document.servers[0] = { url: `${inputURL.protocol}//${inputURL.host}` };
    } else if (!server.url.startsWith('http') && !server.url.startsWith('//')) {
      document.servers[0] = { url: `${inputURL.protocol}//${inputURL.host}${server.url}` };
    }
  }

  // override the api root for servers
  if (root) {
    if (!root.startsWith('/')) {
      root = `$/{root}`;
    }
    if (document.servers) {
      document.servers = document.servers.map((server) => {
        try {
          const serverURL = new URL(server.url);
          return {
            ...server,
            url: `${serverURL.protocol}//${serverURL.host}${root}`,
          };
        } catch {
          return {
            ...server,
            url: root,
          };
        }
      });
    } else {
      document.servers = { url: root };
    }
  }

  return document;
}

export enum OutputFormat {
  JSON = 'json',
  YAML = 'yaml',
}

interface OutputOpts {
  document: SwaggerParser.Document;
  format?: OutputFormat;
}
export function stringifyDocument({ document, format }: OutputOpts): string {
  if (format === OutputFormat.JSON) {
    // JSON output
    return JSON.stringify(document, null, 2);
  } else {
    // YAML output
    return YAML.safeDump(document, { noRefs: true, lineWidth: 240, noArrayIndent: true });
  }
}

// walk backwards from cwd until homedir and check if CONFIG_FILENAME exists
export function resolveConfigFile() {
  let dir = path.resolve(process.cwd());
  while (dir.length >= homedir().length) {
    const check = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(check)) {
      return path.join(dir, CONFIG_FILENAME);
    } else {
      // walk backwards
      dir = path.resolve(path.join(dir, '..'));
    }
  }
}

export function resolveDefinition(definitionArg: string) {
  // check definitionArg
  if (definitionArg && definitionArg !== 'CURRENT') {
    return definitionArg;
  }

  if (process.env.OPENAPI_DEFINITION && definitionArg !== 'CURRENT') {
    return process.env.OPENAPI_DEFINITION;
  }

  const configFile = resolveConfigFile();
  if (configFile) {
    const config = YAML.safeLoad(fs.readFileSync(configFile));
    return config.definition;
  }
}

export function printInfo(document: SwaggerParser.Document, ctx: Command) {
  const { info, externalDocs } = document;
  if (info) {
    const { title, version, description, contact } = info;
    ctx.log(`title: ${title}`);
    ctx.log(`version: ${version}`);
    if (description) {
      ctx.log(`description: ${description}`);
    }
    if (contact) {
      if (contact.email && contact.name) {
        ctx.log(`contact: ${contact.name} <${contact.email}>`);
      } else if (contact.name) {
        ctx.log(`contact: ${contact.name}`);
      } else if (contact.email) {
        ctx.log(`contact: ${contact.email}`);
      }
      if (contact.url) {
        ctx.log(`website: ${contact.url}`);
      }
    }
  }
  if (externalDocs) {
    ctx.log(`docs: ${externalDocs.url}`);
  }
}

export function getOperations(document: SwaggerParser.Document) {
  const operations = [];
  for (const path in document.paths) {
    if (document.paths[path]) {
      for (const method in document.paths[path]) {
        if (document.paths[path][method]) {
          operations.push(document.paths[path][method]);
        }
      }
    }
  }
  return uniqBy(operations, 'operationId');
}

export function printOperations(document: SwaggerParser.Document, ctx: Command) {
  const operations: { [tag: string]: { routes: string[]; description?: string } } = {};

  if (document.tags) {
    for (const tag of document.tags) {
      const { name, description } = tag;
      operations[name] = {
        description,
        routes: [],
      };
    }
  }

  for (const path in document.paths) {
    if (document.paths[path]) {
      for (const method in document.paths[path]) {
        if (document.paths[path][method]) {
          const { operationId, summary, description, tags } = document.paths[path][method];
          let route = `${method.toUpperCase()} ${path}`;
          if (summary) {
            route = `${route} - ${summary}`;
          } else if (description) {
            route = `${route} - ${description}`;
          }
          if (operationId) {
            route = `${route} (${operationId})`;
          }
          for (const tag of tags || ['default']) {
            if (!operations[tag]) {
              operations[tag] = { routes: [] };
            }
            operations[tag].routes.push(route);
          }
        }
      }
    }
  }

  ctx.log('Operations:');
  for (const tag in operations) {
    if (operations[tag]) {
      const routes = operations[tag].routes;
      for (const route of routes) {
        ctx.log(`- ${route}`);
      }
    }
  }
}

export function printSchemas(document: SwaggerParser.Document, ctx: Command) {
  const schemas = (document.components && document.components.schemas) || {};
  const count = Object.entries(schemas).length;
  if (count > 0) {
    ctx.log(`Schemas (${count}):`);
    for (const schema in schemas) {
      if (schemas[schema]) {
        ctx.log(`- ${schema}`);
      }
    }
  }
}
