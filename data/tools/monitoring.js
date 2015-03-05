/*
   Fathom - Browser-based Network Measurement Platform

   Copyright (C) 2011-2015 Inria Paris-Roquencourt 
                           International Computer Science Institute (ICSI)

   See LICENSE for license and terms of usage. 
*/

/**
 * @fileoverview Monitoring graphs.
 * @author Anna-Kaisa Pietilainen <anna-kaisa.pietilainen@inria.fr> 
 */

// y-axis metrics
const ylabels = {
    'cpu' : 'CPU utilization',
    'load' : 'Load',
    'tasks' : 'Number of tasks',
    'mem' : 'Memory (Bytes)',
    'traffic' : 'Network traffic (bit/s)',
    'wifi' : 'Level (dBm)',
    'rtt' : 'Round-trip-time (ms)'
};

// map metric group to series and their labels
const linelabels = {
    'tasks' : {
	'tasks_total' : "All", 
	'tasks_running' : 'Running', 
	'tasks_sleeping' : 'Sleeping'
    },
    'load' : {
	'loadavg_onemin' : '1-min', 
	'loadavg_fivemin' : '5-min', 
	'loadavg_fifteenmin' : '15-min'
    },
    'cpu' : {
	'cpu_user' : 'User', 
	'cpu_system' : 'System', 
	'cpu_idle' : 'Idle'
    },
    'mem' : {
	'mem_total' : 'Available', 
	'mem_used' : 'Used', 
	'mem_free' : 'Free', 
	'mem_ff' : 'Used by Firefox'
    },
    'wifi' : {
	'wifi_signal' : 'Signal',
	'wifi_noise' : 'Noise'
    },
    'traffic' : {
	'rx' : "Received", 
	'tx' : "Transmitted"
    },
    'rtt' : {
	'rtt1' : 'Home gateway (1st hop)', 
	'rtt2' : 'Access link (2nd hop)', 
	'rtt3' : 'ISP (3rd hop)', 
	'rttx' : 'Measurement server (in France)'
    }
}

var getxrange = function(range) {
    var max_x = new Date();
    var min_x = undefined;
    var iv = undefined;
    switch (range) {
    case "day":
	// beg of next hour
	max_x.setHours(max_x.getHours()+1,0);
	// -24h - 1sec ago
	min_x = new Date(max_x.getTime() - 24*60*60*1000 - 1000);  
	iv = 120;
	break;
    case "week":
	max_x.setDate(max_x.getDate()+1);
	min_x = new Date(max_x.getTime() - 7*24*60*60*1000 - 1000);
	iv = 600;
	break;
    case "month":
	max_x.setDate(max_x.getDate()+7);
	min_x = new Date(max_x.getTime() - 30*24*60*60*1000 - 1000);  
	iv = 3600;
	break;
    case "year":
	max_x.setMonth(max_x.getMonth()+1);
	min_x = new Date(max_x.getTime() - 365*24*60*60*1000 - 1000);  
	iv = 6*3600;
	break;
    }
    return [min_x,max_x,iv];
};

/** metricsgraphics implementation */
var drawemptychart = function(metric) {
    MG.data_graphic({
	error: 'No data available',
	chart_type: 'missing-data',
	missing_text: 'No data available',
	target: '#chart-'+metric,
	width: 640,
	height: 480,
	left: 20,
	right: 20,
	top: 10,
    });
};

var drawchart = function(metric, range, data) {
    var xrange = getxrange(range);

    var lines = _.map(_.keys(data), function(k) { 
	return linelabels[metric][k];
    });

    // array of array per line
    var linedata = _.map(_.keys(data), function(k) {
	var tmp = _.filter(data[k], function(d) {
	    // filter away non range values
	    return (d['date']>=xrange[0] && d['date']<=xrange[1]);
	});
	// add zeroes to hide gaps
	var res = [];
	var prev = undefined;
	var lim = 2*xrange[2]*1000; // twice the measurement iv (ms)
	_.each(tmp, function(v) {
	    if (prev && (v['date'].getTime()-prev['date'].getTime()) > lim) {
		// gap
		res.push({ 
		    date : new Date(prev['date'].getTime()+1000*xrange[2]/2),
		    value : null,
		    missing : true,
		    metric : prev['metric']});
		res.push({ 
		    date : new Date(v['date'].getTime()-1000*xrange[2]/2),
		    value : null,
		    missing : true,
		    metric : prev['metric']});
	    }
	    res.push(v);
	    prev = v;
	});
	return res;
    });

    if (linedata.length <= 0 || linedata[0].length <= 0)
	return;

    MG.data_graphic({
	width: 640,
	height: 480,
	left: 120,
	right: 20,
	top: 30,
	target: '#chart-'+metric,
	data: linedata,
	min_y: (metric === 'rtt' ? 0.1 : undefined),
	max_y: (metric === 'rtt' ? 1000 : undefined),
	y_autoscale: (metric !== 'rtt'),
	min_x: xrange[0],
	max_x: xrange[1],
	interpolate : 'linear',
	missing_is_undefined : true,
	x_accessor: 'date',
	y_accessor: 'value',
	format: (metric === 'cpu' ? 'percentage' : 'count'),
	y_scale_type: (metric === 'rtt' ? 'log' : 'linear'),
	area: false,
	y_label: ylabels[metric],
	y_extended_ticks: true,
	show_secondary_x_label : (range==='year'),
	legend : lines,
	legend_target : '#legend-'+metric,
	aggregate_rollover: true
    });
};

/** metricsgraphics implementation */
var drawenvchart = function(range, data) {
    var xrange = getxrange(range);
    var datainrange = _.filter(data, function(d) {
	var ts = new Date(d.ts);
	return (ts>=xrange[0] && ts<=xrange[1]);
    });
    if (datainrange.length <= 0)
	return;

    var idx = 0;
    var envs = {};

    // add #num suffix to make labels unique
    var uniqlabel = function(label) {
	var t = _.find(envs, function(v) {
	    return (v.l === label || v.l === label+' [1]');
	});

	if (t) {
	    // two or more networks with the same label
	    if (!t.lidx) {
		t.lidx = 1
		t.l += ' ['+t.lidx+']'; // 1st
	    }
	    t.lidx += 1;
	    label += '['+t.lidx+']';
	} // else first with this label
	return label;
    };

    var ddata = _.map(data, function(d) { 
	if (!envs[d.env_id]) {
	    idx += 1;
	    var e = { 
		id : idx, 
		l : 'Environment' + idx // name must be unique!
	    };

	    if (d.userlabel) {
		// user has given a label (unique by design)
		e.l = d.userlabel; 
	    } else if (d.ssid) {
		e.l = uniqlabel(d.ssid);
	    } else if (d.isp) {
		e.l = uniqlabel(d.isp);
	    }
	    envs[d.env_id] = e;
	}

	// for the graphic
	d.date = new Date(d.ts);
	d.y = envs[d.env_id].id;
	d.env = envs[d.env_id].l;
	return d;
    });

    MG.data_graphic({
	data: datainrange,
	chart_type: 'point',
	width: 640,
	height: 25*_.size(envs)+50,
	left: 50,
	right: 20,
	top: 30,
	target: '#chart-env',
	min_y: 1,
	max_y: _.size(envs),
	min_x: xrange[0],
	max_x: xrange[1],
	color_range : ["#8a89a6", "#6b486b", "#d0743c", "#98abc5", "#7b6888", "#a05d56", "#ff8c00"],
	x_accessor: 'date',
	y_accessor: 'y',
	color_accessor:'env',
	color_type:'category',
	show_secondary_x_label : (range==='year'),
	legend : _.uniq(_.pluck(envs, 'l')),
	legend_target : '#legend-env',
	show_rollover_text: false,
	mouseover: function(d, i) {
	    // custom format the rollover text, describe env
	    d = d.point;
	    
	    var text = d3.select('#chart-env svg .mg-active-datapoint');
	    text.text('');

	    text.append('tspan').text(d.env);

	    var lc = 1;
	    if (d.ssid) {
		text.append('tspan')
		.attr({
                    x: 0,
                    y: (lc * 1.1) + 'em'
                })
		.text("WiFi: " + d.ssid);
		lc +=1;
	    }
	    text.append('tspan')
		.attr({
                    x: 0,
                    y: (lc * 1.1) + 'em'
                })
		.text("Gateway: " + d.gateway_ip);
	    lc +=1;

	    text.append('tspan')
		.attr({
                    x: 0,
                    y: (lc * 1.1) + 'em'
                })
		.text("ISP: " + d.isp);
	    lc +=1;

	    text.append('tspan')		
		.attr({
                    x: 0,
                    y: (lc * 1.1) + 'em'
                })
		.text("Location: " + d.city + ", " + d.country);
	}
    });
};

/** Get baseline data for the range and (re-)draw graphs. */
var loadgraphs = function(range) {    
    $('#waitspin').show();

    // clear all figures and set to no data
    $('#chart-env').empty();
    drawemptychart('env');
    _.each(_.keys(linelabels), function(metric) {
	$('#chart-'+metric).empty();
	drawemptychart(metric);
    });

    var error = function(err) {
	$('#waitspin').hide();
	console.error(err);
	fathom.close();
	return;
    };

    fathom.init(function() {
	fathom.baseline.getEnv(function(res) {
	    if (res.error) 
		return error(res.error);
	    if (!res.data || res.data.length <= 0) 
		return error('no baseline env data');

	    drawenvchart(range, res.data);

	    fathom.baseline.get(function(res) {
		if (res.error) 
		    return error(res.error);
		if (!res.data || res.data.length <= 0) 
		    return error('no baseline measurement data');

		$('#waitspin').hide();
		fathom.close();

		_.each(_.keys(linelabels), function(metric) {
		    var flatres = [];
		    var tmp = { tx : -1, rx : -1, txts : undefined, rxts : undefined };

		    _.each(res.data, function(sample) {
			_.each(linelabels[metric], function(stitle,sname) {
			    if (!sample[sname]) return; // ignore empty vals

			    var obj = {
				date : new Date(sample.ts),
				value : sample[sname],
				metric : sname
			    };

			    if (metric == 'cpu')
				obj.value = obj.value/100.0;

			    if (metric == 'traffic' && sname == 'tx') {
				if (tmp.txts && sample.ts-tmp.txts>0) {
				    // average cross-traffic bit/s
				    obj.value = ((sample[sname] - tmp.tx)*8.0)/(sample.ts - tmp.txts);
				} else {
				    obj = undefined;
				}
				tmp.tx = sample[sname];
				tmp.txts = sample.ts;
			    }

			    if (metric == 'traffic' && sname == 'rx') {
				if (tmp.rxts && sample.ts-tmp.rxts>0) {
				    // average cross-traffic bit/s
				    obj.value = ((sample[sname] - tmp.rx)*8.0)/(sample.ts - tmp.rxts);
				} else {
				    obj = undefined;
				}
				tmp.rx = sample[sname];
				tmp.rxts = sample.ts;
			    }

			    if (obj)
				flatres.push(obj);
			});
		    });
		    flatres = _.groupBy(flatres, 'metric');
		    setTimeout(drawchart,0,metric,range,flatres);
		});

	    }, range);
	}, range);
    });
};

$(window).load(function() {
    $('#waitspin').hide();
    var fathom = fathom || window.fathom;
    if (!fathom)
	throw "Fathom not found";

    _.each(['day','month','week','year'], function(range) {
	$('#last'+range).click(function() {
	    // button styles
	    $('.pure-button-active').removeClass('pure-button-active');
	    $('#last'+range).addClass('pure-button-active');

	    // draw
	    loadgraphs(range);	
	});
    });

    // default view last 24h
    loadgraphs('day');
});

