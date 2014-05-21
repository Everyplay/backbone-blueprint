var modules = require('./modules');
var Backbone = modules.Backbone;

var Collection = Backbone.Collection.extend({
  initialize: function(models, options) {
    options = options || {};
    Collection.__super__.initialize.apply(this, arguments);
    this._defaultProjectionOptions = options.defaultProjectionOptions
      ? options.defaultProjectionOptions
      : this.getProjectionOptionsFromModel();
  },
  defaultProjectionOptions: function() {
    return this._defaultProjectionOptions;
  },
  getProjectionOptionsFromModel: function() {
    var model = new this.model();
    return model.defaultProjectionOptions ? model.defaultProjectionOptions() : {};
  }
});

module.exports = Collection;