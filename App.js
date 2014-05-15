var app = null;

Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	items:{ 
		// html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'
	},

	config: {
		defaultSettings: {
			itemtype : 'Theme',
			items : 'TH2594',
			unittype : 'Count',
			stateField : 'ScheduleState'
		}
	},

	getSettingsFields: function() {
		return [
			{
				name: 'itemtype',
				xtype: 'rallytextfield',
				label : "Item Type eg. 'Initiaitve'"
			},
			{
				name: 'items',
				xtype: 'rallytextfield',
				label : "Portfolio Items (comma separated)"
			},
			{
				name: 'unittype',
				xtype: 'rallytextfield',
				label : "'Points' or 'Count'"
			},
			{
				name: 'stateField',
				xtype: 'rallytextfield',
				label : "Story State Field"
			}

		];
	},

	launch: function() {
		//Write app code here
		console.log("launch");
		app = this;

		var items = app.getSetting('items').split(",");
		app.itemtype = app.getSetting('itemtype');
		app.stateField = app.getSetting('stateField');
		var unittype = app.getSetting('unittype');

		items = items != "" ? items : ['I2921','I2912','I2968','I2962']; // ['F1123','F1217','F1215','F1220'];
		if (items=="")
			return;

		// read the items
		var configs = _.map( items,function(item) {
			return {
				model : "PortfolioItem/" + app.itemtype,
				fetch : ["FormattedID","ObjectID","Name","PlannedStartDate","PlannedEndDate"],
				filters: [{ property : "FormattedID", operator : "=", value : item}]
			};
		});	

		app.myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait..."});
		app.myMask.show();

		async.map( configs, app.wsapiQuery,function(err,results) {

			var pis = _.map(results,function(r){ return r[0];});
			console.log("pis",pis);

			if (app.validateItems(items,pis)===false)
				return;

			async.map( [pis], app.snapshotquery, function(err,results) {

				console.log("snapshots",results[0].length);

				var m = _.min(results[0],function(s) { return Rally.util.DateTime.fromIsoString(s["_ValidFrom"]);});
				console.log("min:",m);

				var renderer = Ext.create("CumulativeFlowRenderer", {
					items : pis,
					snapshots : results[0],
		            stateField : app.stateField,
            		states : ["Idea","Defined","In-Progress","Completed","Accepted","Released"],
            		unitType : unittype,
				});

				var chart = app.down("#chart1");
				if (chart !== null)
					chart.removeAll();
				chart = renderer.createChart("chart1","CumulativeFlow");

				app.add(chart);
				chart = app.down("#chart1");
				var p = Ext.get(chart.id);
				elems = p.query("div.x-mask");
				_.each(elems, function(e) { e.remove(); });
				var elems = p.query("div.x-mask-msg");
				_.each(elems, function(e) { e.remove(); });

				app.myMask.hide();
			});
		});
	},

	validateItems : function ( ids,items ) {
		var valid = true;

		if (items===null||items===undefined) {
			console.log("items not found");
			app.myMask.hide();
			Rally.ui.notify.Notifier.show({ message : "Items Not found!" });
			valid = false;
		}


		_.each( items, function(item,x) {
			if (item===undefined||item===null) {
				console.log("id not found",ids[x]);
				app.myMask.hide();
				Rally.ui.notify.Notifier.show({
					message: ids[x] + " Not found!"
				});
				valid = false;
			}
			if (item!== undefined) {
				if ((item.get("PlannedStartDate")===null)||(item.get("PlannedEndDate")===null)) {
					console.log("no start or end date ",ids[x]);
					app.myMask.hide();
					Rally.ui.notify.Notifier.show({
						message: ids[x] + " does not have a planned start or end date!"
					});
					valid = false;
				}
			}
		});

		return valid;

	},

	// generic function to perform a web services query    
	wsapiQuery : function( config , callback ) {
		Ext.create('Rally.data.WsapiDataStore', {
			autoLoad : true,
			limit : "Infinity",
			model : config.model,
			fetch : config.fetch,
			filters : config.filters,
			listeners : {
				scope : this,
				load : function(store, data) {
					callback(null,data);
				}
			}
		});
	},

	snapshotquery : function(items,callback) {

		var snaps = localStorage.getItem("snapshots1");
		if ( snaps !== null) {
			callback(null,JSON.parse(snaps));
		}

		// console.log(app.getContext().getProject().ObjectID);
		console.log("Snapshotquery for Items",items);

		var item  = items[0];
		var parentId = item.get("ObjectID");
		console.log("item:",item,parentId);

		// only works for first item ---- fix!!

		var storeConfig = {
			find : {
				'_TypeHierarchy' : { "$in" : ["HierarchicalRequirement"] },
				'_ItemHierarchy' : { "$in" : [parentId] },
				'_ProjectHierarchy' : { "$in": [app.getContext().getProject().ObjectID] }
			},
			autoLoad : true,
			pageSize:1000,
			limit: 'Infinity',
			fetch: ['ScheduleState','FormattedID','_UnformattedID','ObjectID','_TypeHierarchy','_ValidFrom','_ValidTo'],
			hydrate: ['_TypeHierarchy','ScheduleState']
		};

		// storeConfig.find['FormattedID'] = { "$in": items };
		// storeConfig.find['_ProjectHierarchy'] = { "$in": this.project };
		// storeConfig.find['_ValidTo'] = { "$gte" : isoStart  };
		storeConfig.listeners = {
			scope : this,
			load: function(store, data, success) {
				var data = _.pluck(data,"data");
				localStorage.setItem("snapshots1",JSON.stringify(data));
				callback(null,data);
			}
		};
		var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);
	}
});
