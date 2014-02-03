/*jshint -W054 */
exports.formatTemplatedProperties = function(template) {
  return new Function("return \""
    + template.replace(/{([^}]+)}+/g, function (value) {
    if (value.indexOf("arguments[") === -1) {
      return value.replace("{", "\"+ this.get('").replace("}", "') + \"");
    } else {
      return value.replace("{", "\"+ ").replace("}", " + \"");
    }
  }) + "\";");
};
