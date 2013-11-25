pc.extend(pc.asset, function () {
    /**
    * @name pc.asset.AssetRegistry
    * @class Container for all assets that are available to this application
    * @constructor Create an instance of an AssetRegistry. 
    * Note: PlayCanvas scripts are provided with an AssetRegistry instance as 'context.assets'.
    * @param {pc.resources.ResourceLoader} loader The ResourceLoader used to to load the asset files.
    * @param {String} prefix The prefix added to file urls before the loader tries to fetch them
    */
    var AssetRegistry = function (loader, prefix) {
        if (!loader) {
            throw new Error("Must provide a ResourceLoader instance for AssetRegistry");
        }

        this.loader = loader;
        this._prefix = prefix || "";

        this._cache = {};
        this._names = {};
    };

    AssetRegistry.prototype = {
        update: function (toc) {
            for (var resourceId in toc.assets) {
                var asset = this.getAssetByResourceId(resourceId);

                if (!asset) {
                    // Create assets for every entry in TOC and add to AssetCache
                    var assetData = toc.assets[resourceId];
                    asset = new pc.asset.Asset(assetData.name, assetData.type, assetData.file, assetData.data, this._prefix);
                    asset.resourceId = resourceId; // override default resourceId
                    this.addAsset(asset);

                    // Register hashes with the resource loader
                    if (asset.file) {
                        this.loader.registerHash(asset.file.hash, asset.getFileUrl());
                    }
                } else {
                    // Update asset data
                    pc.extend(asset, toc.assets[resourceId]);
                }

            }
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#all
        * @description Return a list of all assets in the registry
        * @returns [pc.asset.Asset] List of all assets in the registry
        */
        all: function () {
            return Object.keys(this._cache).map(function (resourceId) {
                return this.getAssetByResourceId(resourceId);
            }, this);
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#addAsset
        * @description Add a new 
        * @param {pc.asset.Asset} asset The asset to add to the registry
        */
        addAsset: function (asset) {
            this._cache[asset.resourceId] = asset;
            this._names[asset.name] = asset.resourceId; // note, this overwrites any previous asset with same name
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#getAsset
        * @description Return the {@link pc.asset.Asset} object in the AssetRegistry with the name provided.
        * @param {String} name The name of the Asset to return
        * @returns {pc.asset.Asset} The named Asset or null if no Asset is found.
        */
        getAsset: function (name) {
            var id = this._names[name];
            if (id && this._cache[id]) {
                return this._cache[id];
            } else {
                return null;
            }
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#getAssetByResourceId
        * @description Return the {@link pc.asset.Asset} object in the AssetRegistry with the resourceId provided
        * @param {String} resourceId The resourceId of the Asset to return
        * @returns {pc.asset.Asset} The Asset or null if no Asset is found.
        */
        getAssetByResourceId: function (resourceId) {
            return this._cache[resourceId];
        },

        /**
        * @private
        */
        getAssetByName: function (name) {
            console.warn("WARNING: setLinearVelocity: Function is deprecated. Set linearVelocity property instead.");
            return this.getAsset(name);
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#load
        * @description Load the resources for a set of assets and return a promise the resources that they load.
        * If the asset type doesn't have file (e.g. Material Asset) then a resource is not returned (the resource list is shorter)
        * NOTE: Usually you won't have to call load() directly as Assets will be loaded as part of the Pack loading process. This is only
        * required if you are loading assets manually without using the PlayCanvas tools.
        * @param {[pc.fw.Asset]} assets The list of assets to load
        * @param {[Object]} [results] List of results for the resources to be stored in. This is usually not required
        * @param {Object} [options] Options to pass on to the loader
        * @returns {Promise} A Promise to the resources
        * @example
        * var asset = new pc.asset.Asset("My Texture", "texture", {
        *   filename: "mytexture.jpg",
        *   url: "/example/mytexture.jpg"
        * });
        */
        load: function (assets, results, options) {
            if (!assets.length) {
                assets = [assets];
            }
            
            if (typeof(options) === 'undefined') {
                // shift arguments
                options = results;
                results = [];
            }

            var requests = []

            assets.forEach(function (asset, index) {
                var existing = this.getAsset(asset.resourceId);
                if (!existing) {
                    // If the asset isn't in the registry then add it.
                    this.addAsset(asset);
                }

                switch(asset.type) {
                    case pc.asset.ASSET_TYPE_MODEL:
                        requests.push(this._createModelRequest(asset));
                        break;
                    case pc.asset.ASSET_TYPE_TEXTURE:
                        requests.push(this._createTextureRequest(asset, results[index]));
                        break;
                    default: {
                        requests.push(this._createAssetRequest(asset));
                        break;
                    }
                }

            }, this);

            // request all assets
            return this.loader.request(requests.filter(function (r) { return r !== null; }), options).then(null, function (error) {
                // Ensure exceptions while loading are thrown and not swallowed by promises
                setTimeout(function () {
                    throw error;
                }, 0)
            });

            // TODO: release this
            // request all assets, also attach loaded resources onto asset
            // return this.loader.request(requests.filter(function (r) { return r !== null; }), options).then(function (resources) {
            //     var promise = new RSVP.Promise(function (resolve, reject) {
            //         var index = 0;
            //         requests.forEach(function (r, i) {
            //             if (r) {
            //                 assets[i].resource = resources[index++];
            //             } else {
            //                 assets[i].resource = null;
            //             }
            //         });
            //         resolve(resources);
            //     });
            //     return promise;
            // }, function (error) {
            //     // Ensure exceptions while loading are thrown and not swallowed by promises
            //     setTimeout(function () {
            //         throw error;
            //     }, 0)
            // });
        },

        _createAssetRequest: function (asset, result) {
            var url = asset.getFileUrl();
            if (url) {
                return this.loader.createFileRequest(url, asset.type);
            } else {
                return null;
            }
            
        },

        _createModelRequest: function (asset) {
            var url = asset.getFileUrl();
            var mapping = (asset.data && asset.data.mapping) ? asset.data.mapping : [];

            return new pc.resources.ModelRequest(url, mapping);
        },

        _createTextureRequest: function (asset, texture) {
            return new pc.resources.TextureRequest(asset.getFileUrl(), null, texture);
        }
    };

    return {
        AssetRegistry: AssetRegistry
    };
}())