// Tiny JSON-Schema subset validator (no dependencies), enough for schema/config.schema.json.
// validate(schema, data) -> [{ path, message }]. Used by the tests and the playground.
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const isType = (v, t) => (t === 'number' ? typeof v === 'number' : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validate(schema, data, root = schema, path = '') {
  const errs = [];
  const err = (message) => errs.push({ path: path || '/', message });
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => (o ? o[k] : undefined), root);
    if (!target) { err(`unresolved $ref ${schema.$ref}`); return errs; }
    return validate(target, data, root, path);
  }
  if ('const' in schema && !same(schema.const, data)) err(`must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => same(e, data))) err(`must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  if (schema.type) {
    const ts = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!ts.some((t) => isType(data, t))) { err(`must be ${ts.join(' or ')}`); return errs; }
  }
  if (schema.oneOf || schema.anyOf) {
    const list = schema.oneOf || schema.anyOf;
    const ok = list.filter((s) => validate(s, data, root, path).length === 0).length;
    if (ok === 0) {
      const detail = list.map((s) => validate(s, data, root, path)).sort((a, b) => a.length - b.length)[0];
      err(`does not match any allowed form${detail && detail[0] ? ` (${detail[0].path}: ${detail[0].message})` : ''}`);
    } else if (schema.oneOf && ok > 1) err('matches more than one form');
  }
  if (typeof data === 'number') {
    if (schema.minimum != null && data < schema.minimum) err(`must be >= ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) err(`must be <= ${schema.maximum}`);
    if (schema.exclusiveMinimum != null && data <= schema.exclusiveMinimum) err(`must be > ${schema.exclusiveMinimum}`);
  }
  if (typeof data === 'string' && schema.pattern && !new RegExp(schema.pattern).test(data)) err(`must match ${schema.pattern}`);
  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems) err(`needs at least ${schema.minItems} item(s)`);
    if (schema.items) data.forEach((v, i) => errs.push(...validate(schema.items, v, root, `${path}/${i}`)));
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const k of schema.required || []) if (!(k in data)) errs.push({ path: `${path}/${k}`, message: 'is required' });
    const props = schema.properties || {};
    for (const k of Object.keys(data)) {
      if (schema.propertyNames) errs.push(...validate(schema.propertyNames, k, root, `${path}/${k}`).map((e) => ({ ...e, message: `unknown key "${k}"` })));
      if (props[k]) errs.push(...validate(props[k], data[k], root, `${path}/${k}`));
      else if (schema.additionalProperties === false) errs.push({ path: `${path}/${k}`, message: 'unknown key' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...validate(schema.additionalProperties, data[k], root, `${path}/${k}`));
    }
  }
  return errs;
}
