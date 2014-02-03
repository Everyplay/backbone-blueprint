var should = require('chai').should();
var Model = require('..').Model;
var Collection = require('..').Collection;

describe('Test Collection', function () {
  var TestModel = Model.extend({});
  var TestCollection = Collection.extend({
    model: TestModel
  });

  it('should init Collection', function() {
    var collection = new Collection();
    collection.length.should.equal(0);
  });
});