/* eslint no-new-func: 0 */
/* eslint quotes: 0 */
exports.formatTemplatedProperties = function(template) {
  return new Function("return \""
    + template.replace(/{([^}]+)}+/g, function (value) {
    if (value.indexOf("arguments[") === -1) {
      return value.replace("{", "\"+ this.get('").replace("}", "') + \"");
    }
    return value.replace("{", "\"+ ").replace("}", " + \"");
  }) + "\";");
};

exports.toBoolean = function(input) {
  if (typeof input === 'string') {
    return input.toLowerCase() === 'true';
  }
  return !!input;
};
