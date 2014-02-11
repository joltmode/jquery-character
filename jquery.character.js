;(function($, window, document, undefined)
{
    /**
     * Plugin namespace.
     * @type {Object}
     */
    $.character = {};
    
    /*
    |--------------------------------------------------------------------------
    | Options.
    |--------------------------------------------------------------------------
    | Options corresponding to plugin.
    */
   
    $.character.defaults = 
    {
        // No models by default.
        models : null,

        // Blacklist by default.
        whitelist : 
        {
            properties : true,
            attributes : false,
            classes : false,
            styles : false
        },

        // Property names to compare.
        properties : false,

        // Attribute names to compare.
        attributes : [],

        // Class names compare.
        classes : [],

        // Style property names compare.
        styles : [],

        // Should we compare constructors?
        constructors : true,

        // Should we compare types?
        types : true,

        // Should we compare names?
        names : true,

        // Should we compare values?
        values : true,

        // Tests that should be also checked for identicality.
        identical : 
        {
            // By default, attributes have to be identical.
            attributes : true,

            // By default, classes have to be identical.
            classes : true,

            // By default, computed styles does not have to be identical.
            styles : false
        },

        // Dump development info?
        debug : false
    };

    /**
     * Global debugging flag.
     * @type {Boolean}
     */
    $.character.debug = false;

    /*
    |--------------------------------------------------------------------------
    | Mirror tables.
    |--------------------------------------------------------------------------
    | Some hardcoded mirror tables that help out some of the DOM comparing
    | filters.
    */
   
    var propertyGeneralizationAbstractions =
    {
        DOMArray : function(input)
        {
            return Array.prototype.slice.call(input, 0);
        }
    };

    var propertyGeneralizationMethods =
    {
        'DOMTokenList' : propertyGeneralizationAbstractions.DOMArray,
        'NamedNodeMap' : propertyGeneralizationAbstractions.DOMArray,
        'HTMLCollection' : propertyGeneralizationAbstractions.DOMArray,
        'NodeList' : propertyGeneralizationAbstractions.DOMArray,
        'CSSStyleDeclaration' : propertyGeneralizationAbstractions.DOMArray
    };

    var namePropertyComparers =
    {
        'Attr' : 'name',
        'Element' : 'tagName'
    };

    var valuePropertyComparers =
    {
        'Attr' : 'value',
        'Element' : 'textContent',
        'Text' : 'textContent'
    };
    
    /*
    |--------------------------------------------------------------------------
    | Helpers.
    |--------------------------------------------------------------------------
    | Methods that DRY out some of the required features.
    */
    
    /**
     * Resolves model node.
     * @param  {mixed} models
     * @return {jQuery}
     */
    $.character.resolveModels = function(models, recurse)
    {
        // Default to false.
        recurse = recurse === true;

        // Get a recursion method.
        var recursion = arguments.callee;
        
        // If one model given, and that's a Node, return immediately.
        if (models instanceof Node)
        {
            var model = models;

            // jQuery only if not recursing.
            if (recurse === false) model = $(model);

            return model;
        }
        
        // If models is already an instance of jQuery, return immediately.
        if (models instanceof jQuery)
        {
            var model = models;

            // If recursing, use nodes.
            if (recurse === true) model = model.toArray();

            return model;
        }
        
        if (typeof models === 'string')
        {
            var model = $(models);

            // If recursing, use nodes.
            if (recurse === true) model = model.toArray();

            return model;
        }
        
        // In case of models being an array, resolve one by one.
        if (models instanceof Array)
        {
            // Cache output.
            var out = [];

            // Iterate models.
            $.each(models, function(index, model)
            {
                // Resolve.
                var resolved = recursion.call(null, model, true);

                // Add based by type.
                if (resolved instanceof Array)
                {
                    out = out.concat(resolved);
                }
                else
                {
                    out.push(resolved);
                }
            });

            return $(out);
        }

        console.warn(models, typeof models);
        throw new Error('Models could not be resolved.');
    };

    /**
     * Resolves property name from a property mirror table.
     * @param  {Object} properties
     * @param  {Object} object
     * @return {Boolean}
     */
    $.character.resolveProperty = function(properties, object)
    {
        var property = null;

        $.each(properties, function(key, value)
        {
            // Attempt to compare to eval'd type.
            if (object instanceof eval(key))
            {
                property = value;
            }
        });

        return property;
    };

    /**
     * Resolves flag for given option.
     * @param  {mixed} model
     * @param  {string} option
     * @return {Boolean}
     */
    $.character.resolveFlag = function(model, option)
    {
        // Check whether applied globally.
        var global = model === true;

        // Check if single local.
        var local = model === option;

        // Re-check local based on key (as array value).
        local = !local && model instanceof Array && model.indexOf(option) > -1;

        // Re-check local based on key => value.
        local = !global && !local && model instanceof Object && model.hasOwnProperty(option) && model[option] === true;

        // Return accordingly.
        return global || local;
    };

    /**
     * Resolves array from given value.
     * @param  {mixed} value
     * @return {Array}
     */
    $.character.resolveArray = function(value)
    {
        // Return immediately if Array.
        if (value instanceof Array) return value;

        // If not array, arrayize.
        return [value];
    };

    /**
     * Logging wrapper that looks up debugging flag.
     * @return {void}
     */
    $.character.log = function()
    {
        if ($.character.debug === true)
        {
            console.log.apply(console, arguments);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Filters.
    |--------------------------------------------------------------------------
    | Filter implementations.
    */

    /**
     * Constructor filter.
     * 
     * Tests to see if both objects are of the same constructor.
     * @param  {mixed} a
     * @param  {mixed} b
     * @return {Boolean}
     */
    $.character.compareConstructors = function(a, b)
    {
        return a instanceof b.constructor;
    };

    /**
     * DOM Node type filter.
     *
     * Tests to see if both nodes are of the same type.
     * @param  {Node} a
     * @param  {Node} b
     * @return {Boolean}
     */
    $.character.compareTypes = function(a, b)
    {
        return a.nodeType === b.nodeType;
    };

    /**
     * DOM Node name filter.
     *
     * Tests to see if both nodes have the same names.
     * @param  {Node} a
     * @param  {Node} b
     * @return {Boolean}
     */
    $.character.compareNames = function(a, b)
    {
        var propertyA = $.character.resolveProperty(namePropertyComparers, a);
        var propertyB = $.character.resolveProperty(namePropertyComparers, b);

        return a[propertyA] === b[propertyB];
    };

    /**
     * DOM Node value filter.
     *
     * Tests to see if both nodes have the same values.
     * @param  {Node} a
     * @param  {Node} b
     * @return {Boolean}
     */
    $.character.compareValues = function(a, b)
    {
        var propertyA = $.character.resolveProperty(valuePropertyComparers, a);
        var propertyB = $.character.resolveProperty(valuePropertyComparers, b);

        return a[propertyA] === b[propertyB];
    };

    /**
     * DOM Node attribute filter.
     *
     * Tests to see if both nodes have the same attributes.
     * @param  {Node} a
     * @param  {Node} b
     * @param  {Array} attributes
     * @param  {Boolean} whitelist
     * @param  {Boolean} identical
     * @return {Boolean}
     */
    $.character.compareAttributes = function(a, b, attributes, whitelist, identical)
    {
        var result = true;

        // Keep track of ignored attributes.
        // They have their own comparation methods.
        var ignoreList = ['class', 'style'];

        if (identical === false || (identical === true && a.attributes.length === b.attributes.length))
        {
            $.each(a.attributes, function(index, attribute)
            {
                // Disable custom comparators.
                if (ignoreList.indexOf(attribute.name) > -1)
                {
                    return true;
                }

                // Determine if exists within our given matching list.
                var existsInList = attributes.indexOf(attribute.name) > -1;

                // If whitelist, skip if does not exist within list.
                // If blacklist, skip if exists.
                var skip = whitelist === true ? !existsInList : existsInList;

                // Skip over to next attribute, if needed.
                if (skip === true) return true;

                if (!b.hasAttribute(attribute.name) || b.attributes[attribute.name].value !== attribute.value)
                {
                    // Did not match.
                    result = false;

                    // Break the loop.
                    return false;
                }
            });
        }
        else
        {
            result = false;
        }

        return result;
    };

    /**
     * DOM Node class list filter.
     *
     * Tests to see if both nodes have the same classes.
     * @param  {Node} a
     * @param  {Node} b
     * @param  {Array} classes
     * @param  {Boolean} whitelist
     * @param  {Boolean} identical
     * @return {Boolean}
     */
    $.character.compareClasses = function(a, b, classes, whitelist, identical)
    {
        var result = true;

        if (identical === false || (identical === true && a.classList.length === b.classList.length))
        {
            $.each(a.classList, function(index, className)
            {
                // Determine if exists within our given matching list.
                var existsInList = classes.indexOf(className) > -1;

                // If whitelist, skip if does not exist within list.
                // If blacklist, skip if exists.
                var skip = whitelist === true ? !existsInList : existsInList;

                // Skip over to next attribute, if needed.
                if (skip === true) return true;

                if (!b.classList.contains(className))
                {
                    // Did not match.
                    result = false;

                    // Break the loop.
                    return false;
                }
            });
        }
        else
        {
            result = false;
        }

        return result;
    };

    /**
     * Object property filter.
     *
     * Tests to see if both objects have the same properties.
     * @param  {mixed} a
     * @param  {mixed} b
     * @param  {Array} properties
     * @param  {Boolean} whitelist
     * @param  {Boolean} identical
     * @return {Boolean}
     */
    $.character.compareProperties = function(a, b, properties, whitelist, identical)
    {
        var result = true;

        // List of properties to ignore due to them having their own comparators.
        var ignoreList = ['style'];

        // Add name filter.
        ignoreList.push($.character.resolveProperty(namePropertyComparers, a));

        // Add value filter.
        ignoreList.push($.character.resolveProperty(valuePropertyComparers, a));

        for (var key in a)
        {            
            var value = a[key];

            // Ignore custom comparators.
            if (ignoreList.indexOf(key) > -1)
            {
                continue;
            }

            // Determine if exists within our given matching list.
            var existsInList = properties.indexOf(key) > -1;

            // If whitelist, skip if does not exist within list.
            // If blacklist, skip if exists.
            var skip = whitelist === true ? !existsInList : existsInList;

            // Skip over to next attribute, if needed.
            if (skip === true) continue;

            if (!key in b || value !== b[key])
            {
                // Did not match.
                result = false;

                // Break the loop.
                break;
            }
        }

        return result;
    };

    /**
     * DOM Node style filters.
     *
     * Tests to see if both nodes have the same style properties.
     * @param  {Node} a
     * @param  {Node} b
     * @param  {Array} styles
     * @param  {Boolean} whitelist
     * @param  {Boolean} identical
     * @return {Boolean}
     */
    $.character.compareStyles = function(a, b, styles, whitelist, identical)
    {
        var result = true;

        if (identical === false || (identical === true && a.style.length === b.style.length))
        {
            $.each(a.style, function(index, property)
            {
                // Determine if exists within our given matching list.
                var existsInList = styles.indexOf(property) > -1;

                // If whitelist, skip if does not exist within list.
                // If blacklist, skip if exists.
                var skip = whitelist === true ? !existsInList : existsInList;

                // Skip over to next attribute, if needed.
                if (skip === true) return true;

                if (b.style[property] !== a.style[property])
                {
                    // Did not match.
                    result = false;

                    // Break the loop.
                    return false;
                }
            });
        }
        else
        {
            result = false;
        }

        return result;
    };
    
    /*
    |--------------------------------------------------------------------------
    | Plugin.
    |--------------------------------------------------------------------------
    | The plugins implementation itself.
    */
   
    /**
     * Characteristics testing method.
     * @param  {mixed} models
     * @param  {object} options
     * @return {Boolean}
     */
    $.fn.character = function(models, options)
    {
        // One argument fallback.
        if (options === undefined && typeof models === 'object')
        {
            options = models;
        }
        else
        {
            options.models = models;
        }

        // Assemble options.
        options = $.extend({}, $.character.defaults, options);
        
        // Set global debugging flag from options.
        $.character.debug = options.debug === true;

        var $models = $.character.resolveModels(options.models);
        var $collection = this;

        // Cache how many elements within the collection have fully matched the
        // characteristics?
        var matched = 0;

        // Log data.
        $.character.log(options, $models.toArray(), $collection.toArray());
        
        // Compare each element against the list of models.
        $collection.each(function()
        {
            var element = this;
            var $element = $(element);

            // Cache how many model characteristics did the element match?
            var matches = 0;

            $models.each(function()
            {
                var model = this;
                var $model = $(model);

                // Test if nodes are the same, no need to compare in such case.
                var sameNode = $element.is($model);

                // Filter cache.
                var filters = [];

                // Current filter cache.
                var filter = true;

                if (!sameNode)
                {
                    if (options.constructors === true && filter !== false)
                    {
                        filters.push(filter = $.character.compareConstructors(model, element));
                        $.character.log('Constructors filter:', filter);
                    }

                    if (options.types === true && filter !== false)
                    {
                        filters.push(filter = $.character.compareTypes(model, element));
                        $.character.log('Types filter:', filter);
                    }

                    // Add name filter, if requested.
                    if (options.names === true && filter !== false)
                    {
                        filters.push(filter = $.character.compareNames(model, element));
                        $.character.log('Names filter:', filter);
                    }

                    // Add value filter if requested.
                    if (options.values === true && filter !== false)
                    {
                        filters.push(filter = $.character.compareValues(model, element));
                        $.character.log('Values filter:', filter);
                    }

                    // Add attribute filter if requested.
                    if (options.attributes !== null && options.attributes !== false && filter !== false)
                    {
                        var identicalAttributes = $.character.resolveFlag(options.identical, 'attributes');

                        var attributes = $.character.resolveArray(options.attributes);
                        var whitelist = $.character.resolveFlag(options.whitelist, 'attributes');

                        filters.push(filter = $.character.compareAttributes(model, element, attributes, whitelist, identicalAttributes));
                        $.character.log('Attributes filter:', filter);
                    }

                    // Add class filter if requested.
                    if (options.classes !== null && options.classes !== false && filter !== false)
                    {
                        var identicalClasses = $.character.resolveFlag(options.identical, 'classes');

                        var classes = $.character.resolveArray(options.classes);
                        var whitelist = $.character.resolveFlag(options.whitelist, 'classes');

                        filters.push(filter = $.character.compareClasses(model, element, classes, whitelist, identicalClasses));
                        $.character.log('Classes filter:', filter);
                    }

                    // Add property filter if requested.
                    if (options.properties !== null && options.properties !== false &&  filter !== false)
                    {
                        var properties = $.character.resolveArray(options.properties);
                        var whitelist = $.character.resolveFlag(options.whitelist, 'properties');

                        filters.push(filter = $.character.compareProperties(model, element, properties, whitelist));
                        $.character.log('Properties filter:', filter);
                    }

                    // Add computed style filter if requested.
                    if (options.styles !== null && options.styles !== false && filter !== false)
                    {
                        var identicalStyles = $.character.resolveFlag(options.identical, 'styles');

                        var styles = $.character.resolveArray(options.styles);
                        var whitelist = $.character.resolveFlag(options.whitelist, 'styles');

                        filters.push(filter = $.character.compareStyles(model, element, styles, whitelist, identicalStyles));
                        $.character.log('Styles filter:', filter);
                    }
                }
                else
                {
                    $.character.log(element, 'and', model, 'are the same node.');
                }

                // Assemble results.
                var passed = $(filters).filter(function(index, value)
                {
                    return value === true;
                }).toArray();

                // Check results.
                if (sameNode || passed.length === filters.length)
                {
                    matches++;
                    $.character.log(element, 'matches the characteristics', options, 'of', model);
                }
                else
                {
                    $.character.log(element, 'does not match the characteristics', options, 'of', model);
                }
            });

            // If matches all models, increment global match count.
            if (matches === $models.length)
            {
                matched++;
            }
        });

        // Reset global debugging flag.
        $.character.debug = options.debug === true;

        return $collection.length === matched;
    };
    
    
})(jQuery, window, document);
