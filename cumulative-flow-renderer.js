Ext.define("CumulativeFlowRenderer", function() {

    var self;

    return {

        config : {
            items : [],
            snapshots : [],
            stateField : "",
            states : [],
            unitType : "Count",
        },

        constructor:function(config) {
            self = this;
            this.initConfig(config);
            return this;
         },

        getCalculator : function() {
            Ext.define("CumulativeFlowCalculator", {
                extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",
                acceptedData : [],
                pointsOffset : [],

                getMetrics : function() {
                    var metrics = [];
                    _.each(self.states,function(state) {
                        metrics.push({
                            as : state,
                            f : self.unitType==='Points' ? 'filteredSum' : 'filteredCount',
                            field : self.unitType==='Points' ? self.stateField : 'ObjectID',
                            filterField : self.stateField,
                            filterValues : [state],
                        });
                    })
                    return metrics;
                },
            });
            return Ext.create("CumulativeFlowCalculator");
        },

        getChartConfig : function() {

            var lumenize = window.parent.Rally.data.lookback.Lumenize;
            // var snapShotData = _.map(self.snapshots,function(d){return d.data;});
            var snapShotData = self.snapshots;
            var calc = self.getCalculator();

            var config = {
                deriveFieldsOnInput: [],
                metrics: calc.getMetrics(),
                summaryMetricsConfig: [],
                deriveFieldsAfterSummary: calc.getDerivedFieldsAfterSummary(),
                granularity: lumenize.Time.DAY,
                tz: 'America/New_York',
                holidays: [],
                workDays: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday'
            };

            var start = _.min( _.map(self.items,function(i){return i.get("PlannedStartDate");}));
            var end   = _.max( _.map(self.items,function(i){return i.get("PlannedEndDate");}));
            var startOnISOString = new lumenize.Time(start).getISOStringInTZ(config.tz);
            var upToDateISOString = new lumenize.Time(end).getISOStringInTZ(config.tz);
            // create the calculator and add snapshots to it.
            var calculator = new lumenize.TimeSeriesCalculator(config);
            calculator.addSnapshots(snapShotData, startOnISOString, upToDateISOString);

            // create a high charts series config object, used to get the hc series data
            var hcConfig = [{ name : "label" }];
            _.each( _.map( calc.getMetrics(), function(m) { 
                return {
                    name : m.as,
                    type : "area",
                    thetitle : m.thetitle
                };
            }), function(c) { hcConfig.push(c);});

            var hc = lumenize.arrayOfMaps_To_HighChartsSeries(calculator.getResults().seriesData, hcConfig);
            var metrics = calc.getMetrics();

            // nullify data values that are outside of the planned start/end date range.
            _.each(metrics,function(m,i){
                var h = hc[i+1];
                _.each(h.data,function(data,x) {
                    var d = Date.parse(hc[0].data[x]);
                    if ((d < m.start) || (d > m.end)) {
                        h.data[x] = null;
                    }
                });
            })
            return hc;
        },

        createChart : function(id,title) {

            var series = self.getChartConfig();
            var tickInterval = series[1].data.length <= (7*20) ? 7 : (series[1].data.length / 10);

            var extChart = Ext.create('Rally.ui.chart.Chart', {
            listeners : {
            },
            columnWidth : 1,
            itemId : id,
            chartData: {
                categories : series[0].data,
                series : series.slice(1, series.length)
            },
            // chartColors: ['Gray', 'Orange', 'Green', 'LightGray', 'Blue','Green'],

            chartConfig : {
                chart: {
                },
                title: {
                style : {
                    fontSize: '10px'
                },
                text: title,
                x: -20 //center
                },
                plotOptions: {
                    area: {
                        stacking: 'normal'
                    },
                    line: {
                        events: { 
                            legendItemClick : 
                                function(a,b,c) {
                                }
                            }
                    },
                    series: {
                        marker: {
                            radius: 1
                        }
                    }
                },
                xAxis: {
                    // plotLines : plotlines,
                    //tickInterval : 7,
                    tickInterval : tickInterval,
                    type: 'datetime',
                    labels: {
                        formatter: function() {
                            return Highcharts.dateFormat('%b %d', Date.parse(this.value));
                        }
                    }
                },
                yAxis: {
                    title: {
                        text: 'count'
                    },
                    plotLines: [{
                        value: 0,
                        width: 1,
                        color: '#808080'
                    }]
                },
                tooltip: {
                },
                legend: { align: 'center', verticalAlign: 'bottom' }
            }
        });
        return extChart;
        }
    }
});
