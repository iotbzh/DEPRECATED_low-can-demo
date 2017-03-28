// parse location to get security token
var urlParams={};
location.search.substr(1).split("&").forEach(function(item) {
	var k = item.split("=")[0];
	var v = decodeURIComponent(item.split("=")[1]); 
	if (k in urlParams) urlParams[k].push(v); else urlParams[k] = [v];
});

var afb = new AFB("api"/*root*/, urlParams.token[0]);
var ws;
var curLat,prvLat;
var curLon,prvLon;
var vspeed = 0, espeed = 0, torque = 0;
var heading = 0;
var R2D = 180.0 / Math.PI;
var D2R = Math.PI / 180.0;
var gapikey = "AIzaSyBG_RlEJr2i7zqJVQijKh4jQrE-DkeHau0";
var src1 = "http://maps.googleapis.com/maps/api/streetview?key="+gapikey+"&size=480x320";
var fuel;
var odoini,odo,odoprv;
var fsrini,fsr,fsrprv;
var con,cons,consa = [ ];
var minspeed = 5;
var wdgClk, wdgLat, wdgLon, wdgVsp, wdgEsp, wdgTrq;
//var wdgVspeed, wdgEspeed;
var wdgView1, wdgHea, wdgCar;
var wdgFue, wdgGpred, wdgGpblack;
var wdgOdo, wdgFsr, wdgCon, wdgConX;
var conscale = 40;
var condt = 60000;

// leaflet maps
var layers={
	googleStreets: L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{
		minZoom: 1,
		maxZoom: 20,
		subdomains:['mt0','mt1','mt2','mt3']
	}),
	googleHybrid: L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
		minZoom: 1,
		maxZoom: 20,
		subdomains:['mt0','mt1','mt2','mt3']
	}),
	googleSat: L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
		minZoom: 1,
		maxZoom: 20,
		subdomains:['mt0','mt1','mt2','mt3']
	}),
	googleTerrain: L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',{
		minZoom: 1,
		maxZoom: 20,
		subdomains:['mt0','mt1','mt2','mt3']
	}),
	openStreetMap: L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		minZoom: 1,
		maxZoom: 19,
		attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
	})
};

var defaultLocation=[47.6243678,-2.7789165];
L.Icon.Default.imagePath="/images";
var maps={
	mapstreet: {
		map: null,
		options: {
			center: defaultLocation,
			layers: layers.openStreetMap,
			zoom: 15,
			attributionControl: false,
		},
		layersControl: {
			"OpenStreetMap": layers.openStreetMap,
			"Google Streets": layers.googleStreets,
			"Google Satellite": layers.googleSat,
			"Google Terrain": layers.googleTerrain,
		},
		path: {
			stroke: true,
			color: "blue",
			weight: "6",
			opacity: "0.9",
			lineCap: "round",
			lineJoin: "round",
			smoothFactor: 0.5,
		}
	},
	mapsat: {
		map: null,
		options: {
			center: defaultLocation,
			layers: layers.googleHybrid,
			zoom: 17,
			attributionControl: false,
		},
		events: {
			load: adjustCar,
			viewreset: adjustCar,
			zoomend: adjustCar,
			move: adjustCar,
			resize: adjustCar,
		}
	}
};
var mapslocked=null;

function initMaps() {
	for (var id in maps) {
		var mh=maps[id];
		mh.map=L.map(id,mh.options);
		if (mh.events) {
			for (var evt in mh.events) {
				mh.map.on(evt,mh.events[evt]);
	
			}
		}
		if (mh.layersControl) {
			L.control.layers(mh.layersControl).addTo(mh.map);
		}
		if (mh.path) {
			mh.path=L.polyline([],mh.path); 
			// TODO: use multicolor lines: https://github.com/hgoebl/Leaflet.MultiOptionsPolyline
			mh.path.addTo(mh.map);
		}
	}
	adjustCar(); // initial call
	setMapsLockState(false);

	wdgView1.src = src1+"&location="+defaultLocation[0]+","+defaultLocation[1]+"&heading=210";
}

function setMapsLockState(b) {
	// do nothing if already in good state
	if (mapslocked === b) return;
	mapslocked=b;

	// maps shouldn't be draggable while trace is active
	for (var id in maps) {
		if (b) {
			maps[id].map.dragging.disable();
			if (maps[id].path) {
				maps[id].path.setLatLngs([]);
			}
		}
		else
			maps[id].map.dragging.enable();
	}
	
	// car visible or not
	if (b) {
		// lock state: car visible
		$(wdgCar).removeClass("invisible");
	}
	else {
		$(wdgCar).addClass("invisible");
	}

	// clear all gauges
	clearGauges();
}

function adjustCar() {
	/* get zoom level on map and adjust scaling ! */
	/* 
	  zoom => scale
	   19 => 1.0 
	   15 => 0.5 
	*/
	var zl=maps.mapsat.map.getZoom();
	var scale=0.125*zl-1.375;
	if (scale<0.5) scale=0.5;
	var trans="scale("+scale+") translate(-50%,-68%) rotate("+heading+"deg)";
	$(wdgCar).css("transform",trans);
	//console.log("zoom:"+zl+" heading:"+heading+" scale:"+scale);
}

function updatePosition() {
	if (curLat !== undefined && curLon !== undefined) {
		if (prvLat !== undefined && prvLon !== undefined && vspeed >= minspeed) {
			heading = Math.round(R2D * Math.atan2((curLon - prvLon)*Math.cos(D2R*curLat), curLat - prvLat));
			wdgHea.innerHTML = String(heading);
		}

		wdgView1.src = src1+"&location="+curLat+","+curLon+"&heading="+heading;

		for (var id in maps) {
			var mh=maps[id];
			mh.map.panTo([curLat,curLon],{
				animate:true,
				duration: 1.0,
				easeLinearity: 1
			});
			if (mh.path) {
				mh.path.addLatLng([curLat,curLon]);
			}
		}
	}
} 

/* gauges creation */
var gauges={};
function initGauges() {
	gauges.speed = new steelseries.Radial('speedGauge', {
		gaugeType: steelseries.GaugeType.TYPE4,
		frameDesign: steelseries.FrameDesign.BLACK_METAL,
		backgroundColor: steelseries.BackgroundColor.CARBON,
		size: 250,
		titleString: "Speed",
		unitString: "Km/h",
		lcdVisible: true,
		niceScale: true,
		maxValue: 200,
		maxMeasuredValue: 0,
		maxMeasuredValueVisible: true,
		thresholdVisible: false,
		ledVisible: false,
		pointerType: steelseries.PointerType.TYPE11,
		useOdometer: true,
		odometerParams: {
			digits: 6
		}
	});

	gauges.rpm = new steelseries.Radial('rpmGauge', {
		gaugeType: steelseries.GaugeType.TYPE4,
		frameDesign: steelseries.FrameDesign.BLACK_METAL,
		backgroundColor: steelseries.BackgroundColor.CARBON,
		size: 200,
		titleString: "RPM",
		unitString: "x1000",
		lcdVisible: false,
		niceScale: true,
		maxValue: 8,
		maxMeasuredValue: 0,
		maxMeasuredValueVisible: false,
		section: [
			steelseries.Section(6, 8, 'rgba(255, 0, 0, 0.7)')
		],
		area: [
			steelseries.Section(6, 8, 'rgba(255, 0, 0, 0.3)')
		],
		thresholdVisible: false,
		ledVisible: false,
		pointerType: steelseries.PointerType.TYPE11
	});

	gauges.fuel = new steelseries.RadialBargraph('fuelGauge', {
		gaugeType: steelseries.GaugeType.TYPE4,
		frameDesign: steelseries.FrameDesign.BLACK_METAL,
		backgroundColor: steelseries.BackgroundColor.CARBON,
		size: 200,
		titleString: "Fuel Rate",
		unitString: "L/100 Km",
		lcdVisible: true,
		lcdColor: steelseries.LcdColor.STANDARD,
		lcdDecimals: 1,
		niceScale: true,
		minValue: 0,
		maxValue: conscale,
		minMeasuredValue: 0,
		maxMeasuredValue: conscale,
		maxMeasuredValueVisible: true,
/*		section: [
			steelseries.Section(0, 8, 'rgba(0, 255, 0, 0.5)'),
			steelseries.Section(8, 16, 'rgba(255, 255, 0, 0.5)'),
			steelseries.Section(16, 26, 'rgba(255, 128, 0, 0.5)'),
			steelseries.Section(26, conscale, 'rgba(255, 0, 0, 0.5)')
		],
*/
		valueGradient: new steelseries.gradientWrapper(
			0,
			conscale,
			[ 0, 8/conscale, 16/conscale, 26/conscale, 1],
			[ 
				new steelseries.rgbaColor(0, 255, 0, 1),
				new steelseries.rgbaColor(255, 255, 0, 1),
				new steelseries.rgbaColor(255, 128, 0, 1),
				new steelseries.rgbaColor(255, 0, 0, 1),
				new steelseries.rgbaColor(255, 0, 0, 1)
			]
		),
		useValueGradient: true,
		thresholdVisible: false,
		ledVisible: false,
		pointerType: steelseries.PointerType.TYPE11
	});

	gauges.clock = new steelseries.DisplaySingle('clockGauge', {
		width: 170,
		height: 50,
		valuesNumeric: false,
		value: "",
	});
	
	gauges.torque = new steelseries.Radial('torqueGauge', {
		gaugeType: steelseries.GaugeType.TYPE2,
		frameDesign: steelseries.FrameDesign.BLACK_METAL,
		backgroundColor: steelseries.BackgroundColor.CARBON,
		size: 200,
		titleString: "Torque",
		unitString: "Nm",
		lcdVisible: false,
		niceScale: true,
		minValue: -500,
		maxValue: 500,
		maxMeasuredValue: 0,
		maxMeasuredValueVisible: false,
		section: [
			steelseries.Section(-500, 0, 'rgba(0, 255, 0, 0.7)'),
			steelseries.Section(0, 1500, 'rgba(255, 128, 0, 0.7)')
		],
		area: [
			steelseries.Section(-500, 0, 'rgba(0, 255, 0, 0.3)'),
			steelseries.Section(0, 1500, 'rgba(255, 128, 0, 0.3)')
		],
		threshold: 0,
		thresholdVisible: true,
		ledVisible: false,
		pointerType: steelseries.PointerType.TYPE4
	});

	/* adjust cluster background size upon resize */
	// TODO: could be doable through CSS, but a bit tricky
	function adjustCluster() {
		var qh=$("#quad1").outerHeight();
		var sh=$("#speedGauge").outerHeight();
		var pct=Math.ceil((1000*sh/qh))/10+1;
		$('#cluster').css("height",pct+"%");
	}
	$(window).resize(adjustCluster);
	adjustCluster();
}

function clearGauges() {
	for (var g in gauges) {
		switch(g) {
			case "clock":
				gauges[g].setValue("-");
				break;
			case "speed":
				gauges[g].setValue(0);
				gauges[g].setOdoValue(0);
				break;
			default:
				gauges[g].setValue(0);
				break;
		}
	}
}

/* only update position when 2 coords have been received, whatever the order */
var coordUpdated=false;

function gotLatitude(obj) {
	prvLat = curLat;
	curLat = obj.data.value;
	wdgLat.innerHTML = String(curLat);
	if (coordUpdated)
		updatePosition();
	coordUpdated=!coordUpdated;
}

function gotLongitude(obj) {
	prvLon = curLon;
	curLon = obj.data.value;
	wdgLon.innerHTML = String(curLon);
	if (coordUpdated)
		updatePosition();
	coordUpdated=!coordUpdated;
}

function gotVehicleSpeed(obj) {
	vspeed = Math.round(obj.data.value);
	wdgVsp.innerHTML = /* wdgVspeed.innerHTML = */ String(vspeed);
	//gauges.speed.setValueAnimated(vspeed);
	gauges.speed.setValue(vspeed);
}

function gotTorque(obj) {
	torque=Math.round(obj.data.value);
	wdgTrq.innerHTML=String(torque);
	gauges.torque.setValue(torque);
}

function gotEngineSpeed(obj) {
	espeed = Math.round(obj.data.value);
	wdgEsp.innerHTML = /* wdgEspeed.innerHTML = */ String(espeed);
	//gauges.rpm.setValueAnimated(espeed/1000);
	gauges.rpm.setValue(espeed/1000);
}

function gotFuelLevel(obj) {
	fuel = Math.round(obj.data.value * 10) / 10;
	if (fuel <= 2) {
		wdgGpred.style.visibility = "visible";
	} else {
		wdgGpred.style.visibility = "hidden";
		wdgGpblack.style.height = Math.max(100 - fuel, 0) + "%";
		wdgFue.innerHTML = fuel;
	}
}

function displayConsumation(c) {
	var i, n;
	n = consa.push(c) - 9;
	while (n > 0) {
		consa.shift();
		n--;
	}
	for (i = 0 ; i < 9 ; i++) {
		if (i + n < 0) {
			wdgConX[i].style.height = "0%";
			wdgConX[i].innerHTML = "";
		} else {
			wdgConX[i].style.height = (100*Math.min(1,consa[i+n]/conscale))+"%";
			wdgConX[i].innerHTML = "<p>"+consa[i+n]+"</p>";
		}
	}
}

function updateConsumation() {
	if (odoprv === undefined) {
		odoprv = odo;
		cons = undefined;
	}
	if (fsrprv === undefined || fsrprv > fsr) {
		fsrprv = fsr;
		cons = undefined;
	}
	if ((odo - odoprv) > 0.075 && fsr != fsrprv) {
		con = Math.round(1000 * (fsr - fsrprv) / (odo - odoprv)) / 10;
		wdgCon.innerHTML = con;
		//gauges.fuel.setValueAnimated(con);
		gauges.fuel.setValue(con);
		var t = Date.now();
		if (cons === undefined) {
			cons = { t: t, f: fsrprv, o: odoprv };
		} else if (t - cons.t >= condt) {
			displayConsumation(Math.round(1000 * (fsr - cons.f) / (odo - cons.o)) / 10);
			cons = { t: t, f: fsr, o: odo };
		}
		odoprv = odo;
		fsrprv = fsr;
	}
}

function gotOdometer(obj) {
	odo = obj.data.value;
	wdgOdo.innerHTML = Math.round(odo * 1000) / 1000;
	updateConsumation();
	gauges.speed.setOdoValue(odo);
}

function gotFuelSince(obj) {
	fsr = obj.data.value;
	wdgFsr.innerHTML = Math.round(fsr * 1000) / 1000;
	updateConsumation();
}

function gotStart(obj) {
	document.body.className = "started";
	curLat = undefined;
	prvLat = undefined;
	curLon = undefined;
	prvLon = undefined;
	vspeed = 0;
	espeed = 0;
	heading = 0;
	odoini = undefined;
	odo = undefined;
	odoprv = undefined;
	fsrini = undefined;
	fsr = undefined;
	fsrprv = undefined;
	cons = undefined;
	consa = [ ];

	wdgFsr.innerHTML = wdgOdo.innerHTML = wdgCon.innerHTML = 
	wdgClk.innerHTML = wdgLat.innerHTML = wdgLon.innerHTML =
	wdgVsp.innerHTML = /*wdgVspeed.innerHTML = */
	wdgEsp.innerHTML = /*wdgEspeed.innerHTML = */
	wdgHea.innerHTML = wdgFue.innerHTML = "?";
	for (var i = 0 ; i < 9 ; i++) {
		wdgConX[i].style.height = "0%";
		wdgConX[i].innerHTML = "";
	}
	setMapsLockState(true);
}

function gotStop(obj) {
	document.body.className = "connected";
	setMapsLockState(false);
}

var msgcnt=0;
var msgprv=0;
var msgprvts=0;
function gotAny(obj) { 
	if (obj.event != "txc/STOP") {
		document.body.className = "started";
		setMapsLockState(true);
	}
	msgcnt++;
	updateClock(obj.data.timestamp);
}

function updateMsgRate() {
	var now=+new Date();
	if (msgprvts) {
		var dt=now-msgprvts;
		msgrate=Math.round((msgcnt-msgprv)*10000/dt)/10;
		wdgMsg.innerHTML=String(msgrate);
	}

	msgprv=msgcnt;
	msgprvts=now;
}

function updateClock(ts) {
	var h=Math.floor(ts/3600);
	ts-=h*3600;
	var m=Math.floor(ts/60);
	ts-=m*60;
	var s=Math.floor(ts);
	ts-=s;

	var chrono=
		('0'+h).slice(-2)+":"+
		('0'+m).slice(-2)+":"+
		('0'+s).slice(-2)+"."+
		Math.floor(ts*10)
	;
		
	wdgClk.innerHTML=chrono;
	gauges.clock.setValue(chrono+" ");
}

function gotStat(obj) {
	wdgStat.innerHTML = obj.data;
}

function onAbort() {
	document.body.className = "not-connected";
	setMapsLockState(false);
}

function onOpen() {
	ws.call("txc/subscribe", {event:[
			"engine_speed",
			"fuel_level",
			"fuel_consumed_since_restart",
			"longitude",
			"latitude",
			"odometer",
			"vehicle_speed",
			"torque_at_transmission",
			"START",
			"STOP"]}, onSubscribed, onAbort);
	ws.call("stat/subscribe", true);
	ws.onevent("stat/stat", gotStat);
}

function onSubscribed() {
	document.body.className = "connected";
	setMapsLockState(false);
	ws.onevent("txc/engine_speed", gotEngineSpeed);
	ws.onevent("txc/fuel_level", gotFuelLevel);
	ws.onevent("txc/fuel_consumed_since_restart", gotFuelSince);
	ws.onevent("txc/longitude", gotLongitude);
	ws.onevent("txc/latitude", gotLatitude);
	ws.onevent("txc/odometer", gotOdometer);
	ws.onevent("txc/vehicle_speed", gotVehicleSpeed);
	ws.onevent("txc/torque_at_transmission", gotTorque);
	ws.onevent("txc/START", gotStart);
	ws.onevent("txc/STOP", gotStop);
	ws.onevent("txc",gotAny);
}

function replyok(obj) {
	document.getElementById("output").innerHTML = "OK: "+JSON.stringify(obj);
}
function replyerr(obj) {
	document.getElementById("output").innerHTML = "ERROR: "+JSON.stringify(obj);
}
function send(message) {
	var api = document.getElementById("api").value;
	var verb = document.getElementById("verb").value;
	ws.call(api+"/"+verb, {data:message}, replyok, replyerr);
}

function doConnect() {
	document.body.className = "connecting";
	setMapsLockState(false);
	ws = new afb.ws(onOpen, onAbort);
}

function doStart(fname) {
	ws.call('txc/start',{filename: fname});
}

function doStop() {
	ws.call('txc/stop',true);
}

$(function() {
	wdgClk = document.getElementById("clk");
	wdgLat = document.getElementById("lat");
	wdgLon = document.getElementById("lon");
	wdgVsp = document.getElementById("vsp");
	//wdgVspeed = document.getElementById("vspeed");
	wdgEsp = document.getElementById("esp");
	//wdgEspeed = document.getElementById("espeed");
	wdgTrq = document.getElementById("trq");
	wdgView1 = document.getElementById("view1");
	wdgHea = document.getElementById("hea");
	wdgCar = document.getElementById("car");
	wdgFue = document.getElementById("fue");
	wdgGpred = document.getElementById("gpred");
	wdgGpblack = document.getElementById("gpblack");
	wdgOdo = document.getElementById("odo");
	wdgFsr = document.getElementById("fsr");
	wdgStat = document.getElementById("stat");
	wdgMsg = document.getElementById("msg");
	wdgCon = document.getElementById("con");
	wdgConX = [
			document.getElementById("con1"),
			document.getElementById("con2"),
			document.getElementById("con3"),
			document.getElementById("con4"),
			document.getElementById("con5"),
			document.getElementById("con6"),
			document.getElementById("con7"),
			document.getElementById("con8"),
			document.getElementById("con9")
		];

	initMaps();
	initGauges();

	doConnect();

	// init interval to compute message rate
	setInterval(updateMsgRate,250);
});

