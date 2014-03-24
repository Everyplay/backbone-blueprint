var modules = require('./modules');
var Backbone = modules.Backbone;

var Collection = Backbone.Collection.extend({
  initialize: function(models, options) {
    options = options || {};
    Collection.__super__.initialize.apply(this, arguments);
    this._defaultProjectionOptions = options.defaultProjectionOptions;
  },
  defaultProjectionOptions: function() {
    return this._defaultProjectionOptions;
  }
});

module.exports = Collection;