/**
 * @fileoverview Enforce usage of dynamic imports for external modules
 * @author Luis Schaab
 */
'use strict';
const fs = require('node:fs');
const { isBuiltin } = require('node:module');
const resolve = require('eslint-module-utils/resolve').default;
const parse = require('eslint-module-utils/parse').default;
const visit = require('eslint-module-utils/visit').default;
const { visitModules } = require('../helpers/module-visitor');
const { isExternalModule } = require('../helpers/module-type');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const traversed = new Set();

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: `problem`, // `problem`, `suggestion`, or `layout`
    docs: {
      description: 'Enforce usage of dynamic imports for external modules',
      recommended: true,
      url: null, // URL to the documentation page for this rule
    },
    fixable: null, // Or `code` or `whitespace`
    schema: [
      {
        type: 'object',
        properties: {
          entryPoints: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
            uniqueItems: true,
          },
          ignoreModules: {
            type: 'array',
            minItems: 0,
            items: { type: 'string' },
            uniqueItems: true,
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      ENFORCE_DYNAMIC_IMPORT: 'External dependency should be dynamic: {{dependency}}',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const entryPoints = new Set(options.entryPoints);
    const ignoreModules = new Set(options.ignoreModules);

    const relativePath = context.filename.replace(`${process.cwd()}/`, '');
    if (!entryPoints.has(relativePath)) {
      return {};
    }

    function visitor(node) {
      const modulePath = node.value;
      if (ignoreModules.has(modulePath) || isBuiltin(modulePath)) {
        return {};
      }

      function detectTopLevelExternalDependency(path) {
        console.log(path);
        // get the contents
        const content = fs.readFileSync(path, { encoding: 'utf8' });

        // parse ast
        let ast, visitorKeys;
        try {
          const result = parse(path, content, context);
          ast = result.ast;
          visitorKeys = result.visitorKeys;
        } catch (err) {
          // can't continue
        }

        visit(ast, visitorKeys, visitModules(visitor));
      }

      console.log(`Node: ${modulePath}`);
      if (!isExternalModule(modulePath)) {
        const absoluteModulePath = resolve(modulePath, context);

        if (!absoluteModulePath || traversed.has(absoluteModulePath)) {
          return {};
        }

        traversed.add(absoluteModulePath);
        detectTopLevelExternalDependency(absoluteModulePath);
      } else {
        context.report({
          node,
          messageId: 'ENFORCE_DYNAMIC_IMPORT',
          data: {
            dependency: modulePath,
          },
        });
      }
    }

    return visitModules(visitor);
  },
};
