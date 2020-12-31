// Gramps - a GTK+/GNOME based genealogy program
//
// Copyright (C) 2014 Pierre Bélissent
// See also https://github.com/andrewseddon/raphael-zpd/blob/master/raphael-zpd.js for parts of code from Raphael-ZPD
//
// This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.
// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
// You should have received a copy of the GNU General Public License along with this program; if not, write to the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA

(function(window, undefined) {
'use strict';
function DwrSvgClass() {}
window.DwrSvg = new DwrSvgClass();

// Each person is drawn with a text SVG element, over a shape (rectangle, path, circle, etc.).
// The same person could appear several times in the graph (duplicates)
// The elements ID used to draw a person are in the form:
//    - SVGTREE_S_<number> : shape for the person (it is an SVG rectangle, path, circle, etc.)
//    - SVGTREE_T_<number> : text for the person (it is an SVG text)

// The graph is built in several passes:
//
// 1. The data is preloaded, and all the elements to draw are listed in eltsAsc, eltsDsc
//    See function Preload
// 2. The HTML corresponding to the graph is created
//    See function Create
// 3. The graph is initialized
//    See function SvgInit, which calls graphsInitialize functions
//
// The graph drawing is performed in several steps:
// 1. Compute the size allocated to each element
//    See function ComputeElementsSizes
// 2. Compute the width of circles for the circular graphs 
//    See function ComputeRays
// 3. Mask the elements that are collapsed
//    See function SvgMaskElts
// 4. Draw every element in eltsAsc, eltsDsc
//    See function SvgCreateElts, which calls drawElement functions

// eltsAsc, eltsDsc: Lists giving the SVG element used to draw a person, in the form
//    - idx: person index (in table 'I')
//    - lev: level (0 = center person, 1 = 1st generation, etc.)
//    - families: array of {
//         fdx: family index (in table 'F')
//         next: list of SVG elements connected to this element (children/parents)
//         next_spou: list of SVG elements connected to this element (spouses)
//    - isSpouse: true if the current element is a spouse
//    - previous: previous element to which this element is connected to, -1 if root element.
//    - ascending: true if the current element is part of the ascending tree, false if the current element is part of the descending tree,
//    - sz: size of the element (typically, proportional to the number of sub-elements)
//    - po: position of the element (relative to other elements for the same generation)
//    - isCollapsed: the SVG elements connected to this element are collapsed
//    - shown: the element is shown (might be hidden when parent element is collapsed)
//    - shape: Raphael shape for the person (rectangle, path, circle, etc)
//    - text: Raphael text for the person, null if not used
//    - shapeAnimation: attributes for hover animation
//    - shapeAnimationReset: attributes for resetting hover animation
//    - shapeTransform: initial transform for the 'shape'
//    - textTransform: initial transform for the 'text'
//    - line: Raphael line drawn to connect this element to previous element, null if not used
//    - textBbox: text bouding box, used for adjusting precisely the text to the shape
var eltsAsc = [];
var eltsDsc = [];

var nbGenAsc; // Number of ancestry generations to draw
var nbGenDsc; // Number of descedants generations to draw
var nbGenAscFound; // Number of ancestry generations found in the tree
var nbGenDscFound; // Number of descedants generations found in the tree

var svgPaper; // Raphael paper object
var svgRoot; // SVG root object

var DimX, DimY; // Size of the viewport in pixels

var rayons, rayonsAsc, rayonsDsc; // Size of the circle for each generation
var szPeopleAsc; // Number of people for each generation (ancestry) TODO à nettoyer
var szPeopleDsc; // Number of people for each generation (descendants) TODO à nettoyer
var minSizeAsc; // Minimal size of the elements (number of sub-elements), for each generation (ancestry)
var minSizeDsc; // Minimal size of the elements (number of sub-elements), for each generation (descendants)

var txtRatioMax = 10.0; // Maximal width / height ratio for the text boxes
var txtRatioMin = 1.0; // Minimal width / height ratio for the text boxes
var linkRatio = 0.2; // Ratio between space reserved for the links  and the box width
var fontFactorX = 1.8, fontFactorY = 1.0;
var coordX = 10000.0, coordY = 10000.0;
var margeX = 200.0, margeY = 200.0;
var svgStroke = 1e10; // Width of the box strokes
var svgStrokeRatio = 10.0; // Minimal ratio box size / stroke
var svgDivMinHeight = 250; // Minimal graph height
var maxAge = 0;
var minPeriod = 1e10;
var maxPeriod = -1e10;
var animationZoom = 1.2;

var hemiA = 0; // Overflow angle for half-circle and quadrant graphs

var x0, y0, w0, h0; // Coordinates of the top-left corner of the SVG graph, + width and height
var x1, y1, w1, h1; // Coordinates of the top-left corner of the SVG sheet, + width and height
var maxTextWidth; // Maximum width of the textboxes

var viewBoxX, viewBoxY, viewBoxW, viewBoxH; // Screen viewbox (top-left corner, width and height)
var viewScale; // Scale factor between SVG coordinates and screen coordinates

var SVG_SEPARATOR_SIZE = 0.3 // Separator size compared to person box size
var SVG_GENDER_K = 0.9; // darkness factor for male gender

var I = Dwr.I;
var F = Dwr.F;


//==============================================================================
//==============================================================================
// Pointers to all graph types and shapes
//==============================================================================
//==============================================================================

var SVG_TYPE_ASC = 0;
var SVG_TYPE_DSC = 1;
var SVG_TYPE_DSC_SPOU = 2;
var SVG_TYPE_BOTH = 3;
var SVG_TYPE_BOTH_SPOU = 4;

var SVG_SHAPE_VERTICAL_TB = 0;
var SVG_SHAPE_VERTICAL_BT = 1;
var SVG_SHAPE_HORIZONTAL_LR = 2;
var SVG_SHAPE_HORIZONTAL_RL = 3;
var SVG_SHAPE_FULL_CIRCLE = 4;
var SVG_SHAPE_HALF_CIRCLE = 5;
var SVG_SHAPE_QUADRANT = 6;

// Initialization function for every type and every shape
var graphsInitialize =
[
	[
		InitAscTreeV,
		InitAscTreeV,
		InitAscTreeH,
		InitAscTreeH,
		InitCircle,
		InitHemi,
		InitQadr
	],
	[
		InitDscTreeV,
		InitDscTreeV,
		InitDscTreeH,
		InitDscTreeH,
		InitCircle,
		InitHemi,
		InitQadr
	],
	[
		InitDscTreeVSpou,
		InitDscTreeVSpou,
		InitDscTreeHSpou,
		InitDscTreeHSpou,
		InitCircle,
		InitHemi,
		InitQadr
	],
	[
		InitBothTreeV,
		InitBothTreeV,
		InitBothTreeH,
		InitBothTreeH,
		InitCircle,
		InitCircle,
		InitCircle
	],
	[
		InitBothTreeVSpou,
		InitBothTreeVSpou,
		InitBothTreeHSpou,
		InitBothTreeHSpou,
		InitCircle,
		InitCircle,
		InitCircle
	]
];

// Drawing function for every type and every shape
var drawElement =
[
	[
		DrawAscTreeV,
		DrawAscTreeV,
		DrawAscTreeH,
		DrawAscTreeH,
		DrawCircle,
		DrawHemi,
		DrawQadr
	],
	[
		DrawDscTreeV,
		DrawDscTreeV,
		DrawDscTreeH,
		DrawDscTreeH,
		DrawCircle,
		DrawHemi,
		DrawQadr
	],
	[
		DrawDscTreeVSpou,
		DrawDscTreeVSpou,
		DrawDscTreeHSpou,
		DrawDscTreeHSpou,
		DrawCircleSpou,
		DrawHemiSpou,
		DrawQadrSpou
	],
	[
		DrawBothTreeV,
		DrawBothTreeV,
		DrawBothTreeH,
		DrawBothTreeH,
		DrawCircleBoth,
		DrawCircleBoth,
		DrawCircleBoth
	],
	[
		DrawBothTreeVSpou,
		DrawBothTreeVSpou,
		DrawBothTreeHSpou,
		DrawBothTreeHSpou,
		DrawCircleBothSpou,
		DrawCircleBothSpou,
		DrawCircleBothSpou
	]
];


//==============================================================================
//==============================================================================
// Document creation
//==============================================================================
//==============================================================================

DwrSvgClass.prototype.Create = function()
{
	var html = '';
	if (!Dwr.search.SvgExpanded)
		html += '<div id="svg-panel" class="panel panel-default dwr-panel-tree"><div class="panel-body">';
	html += '<div id="svg-drawing" class="' + (Dwr.search.SvgExpanded ? 'svg-drawing-expand' : 'svg-drawing') + '">';
	// Buttons div
	html += '<div id="svg-buttons">';
	html += '<div class="btn-group-vertical" role="group">';
	html += '<button id="svg-expand" type="button" class="btn btn-default" title="' + (Dwr.search.SvgExpanded ? _('Restore') : _('Maximize')) + '">';
	html += '<span class="glyphicon glyphicon-fullscreen"></span>';
	html += '</button>';
	html += '<button id="svg-zoom-in" type="button" class="btn btn-default" title="' + _('Zoom in') + '">';
	html += '<span class="glyphicon glyphicon-zoom-in"></span>';
	html += '</button>';
	html += '<button id="svg-zoom-out" type="button" class="btn btn-default" title="' + _('Zoom out') + '">';
	html += '<span class="glyphicon glyphicon-zoom-out"></span>';
	html += '</button>';
	html += '<button id="svg-config" type="button" class="btn btn-default" title="' + _('Configuration') + '">';
	html += '<span class="glyphicon glyphicon-cog"></span>';
	html += '</button>';
	html += '<button id="svg-saveas" type="button" class="btn btn-default" title="' + _('Save tree as file') + '">';
	html += '<span class="glyphicon glyphicon-save"></span>';
	html += '</button>';
	html += '<button id="svg-help" type="button" class="btn btn-default" title="' + _('Help') + '">';
	html += '<span class="glyphicon glyphicon-question-sign"></span>';
	html += '</button>';
	html += '</div>';
	html += '</div>';
	// Floating popup div
	html += '<div id="svg-popup" class="popover svg-popup">';
	html += '</div>';
	html += '</div>'; // svg-drawing
	if (!Dwr.search.SvgExpanded)
		html += '</div></div>'; // panel
	$(window).load(SvgInit);
	// $(document).ready(SvgInit);
	return(html);
}


function SvgInit()
{
	// Prepare graph data
	ComputeElementsSizes();
	ComputeRays();
	// Initialize graph dimensions
	CalcBoundingBox();
	graphsInitialize[Dwr.search.SvgType][Dwr.search.SvgShape]();
	CalcViewBox();
	svgPaper = new Raphael('svg-drawing', DimX, DimY);
	$(svgPaper.canvas).attr('xmlns:xlink', "http://www.w3.org/1999/xlink");
	svgPaper.setViewBox(0, 0, viewBoxW, viewBoxH, true);
	svgRoot = svgPaper.canvas;
	// Compute the stroke-width depending on graph size
	svgStroke = Math.min(svgStroke, 0.5 / viewScale);
	// Floating popup
	SvgPopupHide();
	$('#svg-popup').mousemove(SvgPopupMove);
	// Prepare the SVG group that will be used for scrolling/zooming
	var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	g.id = 'viewport';
	svgRoot.appendChild(g);
	svgPaper.canvas = g;
	var s = 'matrix(' + viewScale + ',0,0,' + viewScale + ',' + (-viewBoxX) + ',' + (-viewBoxY) + ')';
	g.setAttribute('transform', s);
	svgPaper.canvas = g;
	// Manage buttons
	$('#svg-zoom-in').click(SvgZoomIn);
	$('#svg-zoom-out').click(SvgZoomOut);
	$('#svg-expand').click(SvgToggleExpand);
	$('#svg-config').click(Dwr.svgConfRef);
	$('#svg-saveas').click(Dwr.svgSaveRef);
	$('#svg-help').click(Dwr.helpTreeNavRef);
	// Setup event handlers
	$(window).mouseup(SvgMouseUpWindow)
		.mousedown(SvgMouseDownWindow)
		.mousemove(SvgMouseMoveWindow)
		.resize(SvgResize);
	$(svgRoot).mousewheel(SvgMouseWheel)
		.attr('unselectable', 'on')
		.css('user-select', 'none')
		.on('selectstart', false)
		.mousedown(SvgMouseDown)
		.mousemove(SvgMouseMoveHover)
		.mouseout(SvgMouseOut);
	$(document)
		.keydown(SvgKeyDown)
		.keyup(SvgKeyUp);
	// Build the graph
	SvgMaskElts();
	SvgCreateElts(0);
	// Context menu
	context.init({
		fadeSpeed: 100,
		before: SvgContextBefore,
		compress: true
	});
	var svgContextMenuItems = [
		// {
			// text: (Dwr.search.SvgExpanded) ? _('Restore') : _('Maximize'),
			// href: Dwr.svgHref(Dwr.search.Idx, !Dwr.search.SvgExpanded)
		// },
		// {text: _('Zoom in'), href: 'javascript:SvgZoomIn();'},
		// {text: _('Zoom out'), href: 'javascript:SvgZoomOut();'}
	];
	context.attach('#svg-drawing', svgContextMenuItems);
}


//==============================================================================
//==============================================================================
// Configuration page
//==============================================================================
//==============================================================================

DwrSvgClass.prototype.ConfPage = function()
{
	var html = '';
	// Graph type selector floating div
	html += '<h1>' + _('SVG tree configuration') + '</h1>';
	html += '<div id="svg-drawing-type" class="panel panel-default svg-drawing-type">';
	html += '<div class="panel-body">';
	html += '<form role="form">';
	html += '<div class="row">';
	html += '<div class="col-xs-12 col-sm-6">';
	html += '<div class="form-group">';
	html += '<label for="svg-type">' + _('SVG tree graph type') + '</label>';
	html += '<select name="svg-type" id="svg-type" class="form-control" size="1" title="' + _('Select the type of graph') + '">';
	for (var i = 0; i < DwrConf.SVG_TREE_TYPES.length; i++)
	{
		html += '<option value="' + i + '"' + ((Dwr.search.SvgType == i) ? ' selected' : '') + '>' + DwrConf.SVG_TREE_TYPES[i] + '</option>';
	}
	html += '</select>';
	html += '</div>'; // form-group
	html += '</div>'; // col-xs-*
	html += '<div class="col-xs-12 col-sm-6">';
	html += '<div class="form-group">';
	html += '<label for="svg-shape">' + _('SVG tree graph shape') + '</label>';
	html += '<select name="svg-shape" id="svg-shape" class="form-control" size="1" title="' + _('Select the shape of graph') + '">';
	for (i = 0; i < DwrConf.SVG_TREE_SHAPES.length; i++)
	{
		html += '<option value="' + i + '"' + ((Dwr.search.SvgShape == i) ? ' selected' : '') + '>' + DwrConf.SVG_TREE_SHAPES[i] + '</option>';
	}
	html += '</select>';
	html += '</div>'; // form-group
	html += '</div>'; // col-xs-*
	html += '</div>'; // row
	html += '<div class="row">';
	html += '<div class="col-xs-12 col-sm-6">';
	html += '<div class="form-group">';
	html += '<label for="svg-distrib-asc">' + _('SVG tree parents distribution') + '</label>';
	html += '<select name="svg-distrib-asc" id="svg-distrib-asc" class="form-control" size="1" title="' + _('Select the parents distribution (fan charts only)') + '">';
	for (i = 0; i < DwrConf.SVG_TREE_DISTRIB_ASC.length; i++)
	{
		html += '<option value="' + i + '"' + ((Dwr.search.SvgDistribAsc == i) ? ' selected' : '') + '>' + DwrConf.SVG_TREE_DISTRIB_ASC[i] + '</option>';
	}
	html += '</select>';
	html += '</div>'; // form-group
	html += '</div>'; // col-xs-*
	html += '<div class="col-xs-12 col-sm-6">';
	html += '<div class="form-group">';
	html += '<label for="svg-distrib-dsc">' + _('SVG tree children distribution') + '</label>';
	html += '<select name="svg-distrib-dsc" id="svg-distrib-dsc" class="form-control" size="1" title="' + _('Select the children distribution (fan charts only)') + '">';
	for (i = 0; i < DwrConf.SVG_TREE_DISTRIB_DSC.length; i++)
	{
		html += '<option value="' + i + '"' + ((Dwr.search.SvgDistribDsc == i) ? ' selected' : '') + '>' + DwrConf.SVG_TREE_DISTRIB_DSC[i] + '</option>';
	}
	html += '</select>';
	html += '</div>'; // form-group
	html += '</div>'; // col-xs-*
	html += '</div>'; // row
	html += '<div class="row">';
	html += '<div class="col-xs-12 col-sm-4">';
	html += '<div class="form-group">';
	html += '<label for="svg-background">' + _('Background') + '</label>';
	html += '<select name="svg-background" id="svg-background" class="form-control" size="1" title="' + _('Select the background color scheme') + '">';
	for (i = 0; i < DwrConf.SVG_TREE_BACKGROUNDS.length; i++)
	{
		html += '<option value="' + i + '"' + ((Dwr.search.SvgBackground == i) ? ' selected' : '') + '>' + DwrConf.SVG_TREE_BACKGROUNDS[i] + '</option>';
	}
	html += '</select>';
	html += '</div>'; // form-group
	html += '</div>'; // col-xs-*
	html += '<div class="col-xs-6 col-sm-4">';
	html += '<div class="form-group">';
	html += '<label for="svg-asc">' + _('Ancestors') + '</label>';
	html += '<select id="svg-asc" class="form-control svg-gens" size="1" title="' + _('Select the number of ascending generations') + '">';
	for (i = 0; i < DwrConf.graphgens; i++)
	{
		html += '<option value="' + i + '"' + ((Dwr.search.Asc == i) ? ' selected' : '') + '>' + i + '</option>';
	}
	html += '</select>';
	html += '</div>'; // form-group
	html += '</div>'; // col-xs-*
	html += '<div class="col-xs-6 col-sm-4">';
	html += '<div class="form-group">';
	html += '<label for="svg-dsc">' + _('Descendants') + '</label>';
	html += '<select id="svg-dsc" class="form-control svg-gens" size="1" title="' + _('Select the number of descending generations') + '">';
	for (i = 0; i < DwrConf.graphgens; i++)
	{
		html += '<option value="' + i + '"' + ((Dwr.search.Dsc == i) ? ' selected' : '') + '>' + i + '</option>';
	}
	html += '</select>';
	html += '</div>'; // form-group
	html += '</div>'; // col-xs-*
	html += '</div>'; // row
	html += '<div class="row">';
	html += '<div class="col-xs-6 col-sm-4">';
	html += '<div class="checkbox">';
	html += '<label>';
	html += '<input type="checkbox" name="svg-dup" id="svg-dup" ' + (Dwr.search.SvgDup ? 'checked' : '') + ' title="' + _('Whether to use a special color for the persons that appear several times in the SVG tree') + '"/>';
	html += _('Show duplicates') + '</label>';
	html += '</div>'; // checkbox
	html += '</div>'; // col-xs-*
	html += '</div>'; // row
	html += '<div class="text-center">';
	html += ' <button id="svg-config-ok" type="button" class="btn btn-primary"> <span class="glyphicon glyphicon-ok"></span> ' + _('OK') + ' </button> ';
	html += ' <button id="svg-config-restore" type="button" class="btn btn-secondary"> <span class="glyphicon glyphicon-cog"></span> ' + _('Restore default settings') + ' </button> ';
	html += ' <button id="svg-config-help" type="button" class="btn btn-secondary"> <span class="glyphicon glyphicon-question-sign"></span> ' + _('Help') + ' </button> ';
	html += '</div>';
	html += '</form>';
	html += '</div>'; // panel-body
	html += '</div>'; // svg-drawing-type

	// Events
	$(window).load(function() {
		$('#svg-config-ok').click(SvgConfSubmit);
		$('#svg-config-restore').click(SvgConfRestore);
		$('#svg-config-help').click(Dwr.helpTreeConfRef);
	});

	return(html);
}

function SvgConfSubmit()
{
	Dwr.search.SvgType = $('#svg-type').val();
	Dwr.search.SvgShape = $('#svg-shape').val();
	Dwr.search.SvgDistribAsc = $('#svg-distrib-asc').val();
	Dwr.search.SvgDistribDsc = $('#svg-distrib-dsc').val();
	Dwr.search.SvgBackground = $('#svg-background').val();
	Dwr.search.Asc = $('#svg-asc').val();
	Dwr.search.Dsc = $('#svg-dsc').val();
	Dwr.search.SvgDup = $('#svg-dup').is(':checked');
	return(Dwr.svgRef());
}

function SvgConfRestore()
{
	$('#svg-type').val(Dwr.defaultSearchString.SvgType);
	$('#svg-shape').val(Dwr.defaultSearchString.SvgShape);
	$('#svg-distrib-asc').val(Dwr.defaultSearchString.SvgDistribAsc);
	$('#svg-distrib-dsc').val(Dwr.defaultSearchString.SvgDistribDsc);
	$('#svg-background').val(Dwr.defaultSearchString.SvgBackground);
	$('#svg-asc').val(Dwr.defaultSearchString.Asc);
	$('#svg-dsc').val(Dwr.defaultSearchString.Dsc);
	$('#svg-dup')[0].checked = Dwr.defaultSearchString.SvgDup;
	return(false);
}


//==============================================================================
//==============================================================================
// Save page
//==============================================================================
//==============================================================================

DwrSvgClass.prototype.SavePage = function()
{
	var html = '';
	html +=
		'<div id="svg-loader" class="text-center">' +
		'<h1>' + _('Preparing file ...') + '</h1>' +
		'</div>';
	html += DwrSvg.Create();

	$(window).load(function() {
		$('body').css('overflow', 'hidden');
	});

	return(html);
}

function SvgSaveText()
{
	$('#svg-loader').html(
		'<h1>' + _('File ready') + '</h1>' +
		_('<p>This page provides the SVG raw code.<br>Copy the contents into a text editor and save as an SVG file.<br>Make sure that the text editor encoding is UTF-8.</p>') +
		'<p class="text-centered"><button id="svg-save-ok" type="button" class="btn btn-primary"> <span class="glyphicon glyphicon-ok"></span> ' + _('OK') + ' </button></p>'
		);
	$('#svg-save-ok').click(SvgSaveOk)
}

function SvgSaveOk()
{
	if ($('#svg-loader').length == 0) return;
	var xml = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
	xml += '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n';
	xml += 'style=\'' + CssDefaultProperties() + '\'\n';
	xml += ' width="' + $('svg').attr('width') + '"';
	xml += ' height="' + $('svg').attr('height') + '"';
	xml += ' viewBox="' + $('svg')[0].getAttribute('viewBox') + '"';
	xml += ' version="' + $('svg').attr('version') + '"';
	xml += ' preserveAspectRatio="' + $('svg')[0].getAttribute('preserveAspectRatio') + '"';
	xml += '>';
	xml += '<style type="text/css">\n';
	xml += '<![CDATA[\n';
	xml += CssProperties('.svg-tree');
	xml += CssProperties('.svg-text');
	xml += CssProperties('.svg-line');
	xml += ']]>\n';
	xml += '</style>\n';
	var svgHtml;
	if (Dwr.BrowserMSIE())
		svgHtml = $('svg')[0].innerHTML;
	else
		svgHtml = $('svg').html();
	xml += removeLinks(svgHtml);
	xml += '</svg>';
	$('body').addClass('svg-save-text');
	$('body').text(formatXml(xml));
	$('body').css('overflow', 'auto');
	return(false);
}

function removeLinks(xml)
{
	xml = xml.replace(/(?:<a [^>]*>|<a>|<\/a [^>]*>|<\/a>)/g, '');
	return xml;
}

function CssProperties(selectorText)
{
	var css_text = selectorText + ' {\n';
	for (var s = 0 ; s < document.styleSheets.length; s++)
	{
		var cssRules = document.styleSheets[s].cssRules ||
			document.styleSheets[s].rules || []; // IE support
		for (var c = 0; c < cssRules.length; c++)
		{
			if (cssRules[c].selectorText === selectorText)
			{
				css_text += cssRules[c].style.cssText;
			}
		}
	}
	css_text += '}\n';
	return(css_text);
}

function CssDefaultProperties()
{
	var css_text = '';
	var style = $('svg')[0].style;
	for (var propertyName in style)
	{
		if (propertyName != propertyName.toLowerCase()) continue;
		if (propertyName.indexOf('webkit') != -1) continue;
		if (typeof(propertyName) == 'string' && isNaN(parseInt(propertyName)))
		{
			var val = style[propertyName];
			if (typeof(val) == 'string')
			{
				val = '' + $('svg').css(propertyName);
				if (val != '' && val.indexOf("'") == -1)
					css_text += ' ' + propertyName + ':' + val + ';';
			}
		}
	}
	return(css_text);
}

function formatXml(xml)
{
	var reg = /(>)\s*(<)(\/*)/g;
	var wsexp = / *(.*) +\n/g;
	var contexp = /(<.+>)(.+\n)/g;
	xml = xml.replace(reg, '$1\n$2$3').replace(wsexp, '$1\n').replace(contexp, '$1\n$2');
	var pad = 0;
	var formatted = '';
	var lines = xml.split('\n');
	var indent = 0;
	var lastType = 'other';
	// 4 types of tags - single, closing, opening, other (text, doctype, comment) - 4*4 = 16 transitions
	var transitions = {
		'single->single'    : 0,
		'single->closing'   : -1,
		'single->opening'   : 0,
		'single->other'     : 0,
		'closing->single'   : 0,
		'closing->closing'  : -1,
		'closing->opening'  : 0,
		'closing->other'    : 0,
		'opening->single'   : 1,
		'opening->closing'  : 0,
		'opening->opening'  : 1,
		'opening->other'    : 1,
		'other->single'     : 0,
		'other->closing'    : -1,
		'other->opening'    : 0,
		'other->other'      : 0
	};

	for (var i=0; i < lines.length; i++) {
		var ln = lines[i];
		var single = Boolean(ln.match(/<.+\/>/)); // is this line a single tag? ex. <br />
		var closing = Boolean(ln.match(/<\/.+>/)); // is this a closing tag? ex. </a>
		var opening = Boolean(ln.match(/<[^!].*>/)); // is this even a tag (that's not <!something>)
		var type = single ? 'single' : closing ? 'closing' : opening ? 'opening' : 'other';
		var fromTo = lastType + '->' + type;
		lastType = type;
		var padding = '';

		indent += transitions[fromTo];
		for (var j = 0; j < indent; j++) {
			padding += '    ';
		}

		formatted += padding + ln + '\n';
	}

	return formatted;
};


//==============================================================================
//==============================================================================
// Tree size and styles
//==============================================================================
//==============================================================================

function CalcBoundingBox()
{
	if ($('.svg-drawing-expand').length == 0)
	{
		var w = $('#svg-drawing').innerWidth();
		var h = $('#svg-drawing').innerHeight();
		var dim = Dwr.InnerDivNetSize(Dwr.BodyContentsMaxSize(), $('#svg-panel'));
		dim = Dwr.InnerDivNetSize(dim, $('#svg-drawing'));
		if (!w || w < svgDivMinHeight) w = dim.width;
		DimX = Math.max(svgDivMinHeight, w);
		DimY = Math.max(svgDivMinHeight, h, dim.height);
	}
	else
	{
		DimX = Math.max(svgDivMinHeight, $(window).width());
		DimY = Math.max(svgDivMinHeight, $(window).height());
	}
	// console.log($('#svg-drawing').width(), $('#svg-drawing').height(), DimX, DimY);
}


function CalcViewBox()
{
	viewScale = Math.min(DimX / w0, DimY / h0);
	x1 = x0 - (DimX / viewScale - w0) / 2;
	y1 = y0 - (DimY / viewScale - h0) / 2;
	w1 = DimX / viewScale;
	h1 = DimY / viewScale;
	// console.log(x0, y0, w0, h0, x1, y1, w1, h1);
	viewBoxX = Math.round(x1 * viewScale);
	viewBoxY = Math.round(y1 * viewScale);
	viewBoxW = DimX;
	viewBoxH = DimY;
}


function SvgMaskElts()
{
	function SvgMaskEltsSub(elts)
	{
		for (var x_elt = 0; x_elt < elts.length; x_elt += 1)
		{
			var elt = elts[x_elt];
			if (!elt.shown)
			{
				if (elt.shape) elt.shape.hide();
				if (elt.text) elt.text.hide();
				if (elt.line) elt.line.hide();
			}
		}
	}
	SvgMaskEltsSub(eltsAsc);
	SvgMaskEltsSub(eltsDsc);
}


function SvgCreateElts(n)
{
	// Difers the SVG element creation
	var incr = 10;
	var x_elt = n
	while ((x_elt < n + incr) && (x_elt < eltsAsc.length))
	{
		drawElement[Dwr.search.SvgType][Dwr.search.SvgShape](eltsAsc, x_elt);
		x_elt += 1;
	}
	x_elt -= eltsAsc.length;
	while ((x_elt >= 0) && (x_elt < n + incr - eltsAsc.length) && (x_elt < eltsDsc.length))
	{
		drawElement[Dwr.search.SvgType][Dwr.search.SvgShape](eltsDsc, x_elt);
		x_elt += 1;
	}
	if (x_elt < eltsDsc.length)
	{
		setTimeout(function()
		{
			SvgCreateElts(n + incr);
		}, 10);
	}
	else
	{
		SvgSaveText();
	}
}


function GetEltFromIndex(x_elt)
{
	if (x_elt < eltsAsc.length) return eltsAsc[x_elt];
	return eltsDsc[x_elt - eltsAsc.length];
}


function SvgSetStyle(x_elt, elt)
{
	// Get the class of the person box and text
	var fill = '#FFFFFF';
	var stroke = '#000000';
	var dark = 1.0;
	if (Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_GENDER)
	{
		var g = 'unknown';
		if (I(elt.idx, 'gender') == 'M') g = 'male';
		if (I(elt.idx, 'gender') == 'F') g = 'female';
		var d = 'alive';
		if (I(elt.idx, 'death_date') != '') d = 'death';
		fill = DwrConf.GRAMPS_PREFERENCES['color-gender-' + g + '-' + d];
	}
	if (Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_GENERATION)
	{
		fill = SvgColorGrad(0, Math.max(nbGenAscFound, nbGenDscFound) - 1, elt.lev);
		dark = SVG_GENDER_K;
	}
	if (
		(Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_AGE) ||
		(Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_PERIOD))
	{
		var b = parseInt(I(elt.idx, 'birth_sdn'));
		var d = parseInt(I(elt.idx, 'death_sdn'));
		var x;
		var m;
		if ((Dwr.search.SvgBackground == 2) && (b > 0) && (d > 0))
		{
			fill = SvgColorGrad(0, maxAge, d - b);
		}
		if ((Dwr.search.SvgBackground == 4) && (minPeriod <= maxPeriod))
		{
			if ((b > 0) && (d > 0))
				fill = SvgColorGrad(minPeriod, maxPeriod, (d + b) / 2.0);
			else if (b > 0)
				fill = SvgColorGrad(minPeriod, maxPeriod, b);
			else if (d > 0)
				fill = SvgColorGrad(minPeriod, maxPeriod, d);
		}
		dark = SVG_GENDER_K;
	}
	if (Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_SINGLE)
	{
		fill = DwrConf.svg_tree_color1;
	}
	if (Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_WHITE)
	{
		fill = DwrConf.SVG_TREE_COLOR_SCHEME0[lev % DwrConf.SVG_TREE_COLOR_SCHEME0.length];
		dark = SVG_GENDER_K;
	}
	if (Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_SCHEME1)
	{
		fill = DwrConf.SVG_TREE_COLOR_SCHEME1[lev % DwrConf.SVG_TREE_COLOR_SCHEME1.length];
		dark = SVG_GENDER_K;
	}
	if (Dwr.search.SvgBackground == DwrConf.SVG_TREE_BACKGROUND_SCHEME2)
	{
		fill = DwrConf.SVG_TREE_COLOR_SCHEME2[lev % DwrConf.SVG_TREE_COLOR_SCHEME2.length];
		dark = SVG_GENDER_K;
	}
	if (Dwr.search.SvgDup && Dwr.isDuplicate(elt.idx))
	{
		fill = DwrConf.svg_tree_color_dup;
	}
	if ((elt.idx < 0) || (I(elt.idx, 'gender') == 'F')) dark = 1.0;
	var fill_hsb = Raphael.rgb2hsb(Raphael.getRGB(fill));
	var fill_rgb = Raphael.hsb2rgb({
		h: fill_hsb.h,
		s: fill_hsb.s,
		b: fill_hsb.b * dark
	});
	fill = Raphael.rgb(fill_rgb.r, fill_rgb.g, fill_rgb.b);
	// Get hyperlink address
	var href = Dwr.svgHref(elt.idx);
	// Set box attributes
	if (!elt.ascending) x_elt += eltsAsc.length;
	elt.shape.node.setAttribute('class', 'svg-tree');
	elt.shape.attr('fill', fill);
	elt.shape.attr('stroke-width', svgStroke);
	elt.shape.node.id = 'SVGTREE_S_' + x_elt;
	if (elt.text)
	{
		// Set box text attributes
		elt.text.node.setAttribute('class', 'svg-text');
		elt.text.node.id = 'SVGTREE_T_' + x_elt;
	}
}


function SvgColorGrad(mini, maxi, value)
{
	var x = value - mini;
	var m = maxi - mini;
	if (x < 0) x = 0;
	if (x >= m) x = m;
	x = (m == 0) ? 0 : 1.0 * x / m;
	// Compute color gradient
	var cstart = Raphael.rgb2hsb(Raphael.getRGB(DwrConf.svg_tree_color1));
	var cend = Raphael.rgb2hsb(Raphael.getRGB(DwrConf.svg_tree_color2));
	var rgb = Raphael.hsb2rgb({
		h: (1.0 + cstart.h + x * ((1.0 + cend.h - cstart.h) % 1.0)) % 1.0,
		s: (1-x) * cstart.s + x * cend.s,
		b: (1-x) * cstart.b + x * cend.b
	});
	return(Raphael.rgb(rgb.r, rgb.g, rgb.b));
}


//==============================================================================
//==============================================================================
//=========================================== Mouse events
//==============================================================================
//==============================================================================

var clickOrigin = null; // Click position when moving / zooming
var svgMoving = false; // The graph is being moved
var tfMoveZoom = null; // move/zoom transform matrix
var hoverBox = -1; // SVG element index (in table eltsAsc or eltsDsc) where is the mouse
var leftButtonDown = false; // Mouse left button position


function SvgGetElt(node)
{
	while (node.id != 'svg-drawing')
	{
		if (node.id.indexOf('SVGTREE_') == 0)
			return(parseInt(node.id.replace(/SVGTREE_[A-Z_]+/, '')));
		node = node.parentNode;
	}
	return(-1);
}


function SvgMouseDownWindow(event)
{
	if (event.button > 0) return(true);
	leftButtonDown = true;
	return(true);
}

function SvgMouseDown(event)
{
	if (event.button > 0) return(true);
	clickOrigin = getEventPoint(event);
	svgMoving = false;
	var g = svgRoot.getElementById('viewport');
	tfMoveZoom = g.getCTM().inverse();
	var x_elt = SvgGetElt(event.target);
	if (x_elt >= 0)
	{
		SvgMouseEventEnter(x_elt);
	}
	return(false);
}

function SvgMouseUpWindow(event)
{
	if (event.button > 0) return(true);
	leftButtonDown = false;
	if (hoverBox >= 0)
	{
		var x_elt = SvgGetElt(event.target);
		if (x_elt == hoverBox)
		{
			var elt = GetEltFromIndex(x_elt);
			if (elt.idx >= 0)
			{
				if (shiftPressed)
				{
					// Go to clicked person page
					Dwr.indiRef(elt.idx);
					return(false);
				}
				else if (ctrlPressed)
				{
					if (!elt.isSpouse)
					{
						SvgMouseEventExitForced();
						// Collapse / uncollapse the clicked person
						elt.isCollapsed = !elt.isCollapsed;
						ComputeElementsSizes();
						ComputeRays();
						SvgMaskElts();
						SvgCreateElts(0);
					}
				}
				else
				{
					// Center graph on clicked person
					Dwr.svgRef(elt.idx);
					return(false);
				}
			}
		}
	}
	clickOrigin = null;
	svgMoving = false;
	tfMoveZoom = null;
	return(true);
}

function SvgToggleExpand(elt)
{
	Dwr.search.SvgExpanded = !($('#svg-drawing').hasClass('svg-drawing-expand'));
	Dwr.svgRef();
}

function SvgMouseMoveWindow(event)
{
	if (clickOrigin)
	{
		var p = getEventPoint(event);
		var d = Math.sqrt((p.x - clickOrigin.x) * (p.x - clickOrigin.x) + (p.y - clickOrigin.y) * (p.y - clickOrigin.y));
		if (d > 10 || svgMoving)
		{
			svgMoving = true;
			var p2 = p.matrixTransform(tfMoveZoom);
			var o2 = clickOrigin.matrixTransform(tfMoveZoom);
			// console.log(p.x, clickOrigin.x, p2.x, o2.x);
			SvgSetGraphCtm(tfMoveZoom.inverse().translate(p2.x - o2.x, p2.y - o2.y));
			SvgMouseEventExit();
			SvgPopupHide();
			return(false);
		}
	}
	if (svgMoving)
	{
		event.stopImmediatePropagation();
		return(false);
	}
	return(true);
}

function SvgMouseMoveHover(event)
{
	if (!svgMoving && !leftButtonDown)
	{
		var elt = SvgGetElt(event.target);
		if (elt >= 0)
		{
			if (elt != hoverBox)
			{
				SvgMouseEventExit();
				SvgPopupHide();
				SvgMouseEventEnter(elt);
			}
			SvgPopupShow(elt, event);
		}
		else if (hoverBox >= 0)
		{
			SvgMouseEventExit();
			SvgPopupHide();
		}
	}
	return(true);
}

function SvgMouseOut(event)
{
	var e = event.toElement || event.relatedTarget;
	if ($(e).attr('id') == 'svg-popup' ||
		e == svgRoot ||
		(e && (e.parentNode == svgRoot ||
		(e.parentNode && (e.parentNode.parentNode == svgRoot ||
		(e.parentNode.parentNode && (e.parentNode.parentNode.parentNode == svgRoot))))))) return(true);
	SvgMouseEventExit();
	SvgPopupHide();
	return(true);
}

function SvgMouseEventExit()
{
	if (hoverBox >= 0)
	{
		var elt = GetEltFromIndex(hoverBox);
		if (elt.shape)
		{
			elt.shape.node.setAttribute('class', 'svg-tree');
			elt.shape.animate(elt.shapeAnimationReset, 200, '<>');
			if (elt.text)
			{
				elt.text.animate(elt.textAnimationReset, 200, '<>');
			}
		}
	}
	hoverBox = -1;
}

function SvgMouseEventExitForced()
{
	if (hoverBox >= 0)
	{
		var elt = GetEltFromIndex(hoverBox);
		if (elt.shape)
		{
			elt.shape.node.setAttribute('class', 'svg-tree');
			elt.shape.attr(elt.shapeAnimationReset);
			if (elt.text)
			{
				elt.text.attr(elt.textAnimationReset);
			}
		}
	}
	hoverBox = -1;
}

function SvgMouseEventEnter(x_elt)
{
	if (x_elt >= 0 && x_elt != hoverBox)
	{
		hoverBox = -1;
		var elt = GetEltFromIndex(x_elt);
		if (elt.shape)
		{
			hoverBox = x_elt;
			elt.shape.node.setAttribute('class', 'svg-tree svg-tree-hover');
			elt.shape.toFront();
			elt.shape.animate(elt.shapeAnimation, 200, '<>');
			if (elt.text)
			{
				elt.text.toFront();
				elt.text.animate(elt.textAnimation, 200, '<>');
			}
		}
	}
}

function SvgMouseWheel(event)
{
	if (event.preventDefault) event.preventDefault();
    var p = getEventPoint(event);
	// See jquery-mousewheel plugin
	// console.log(event.deltaX, event.deltaY, event.deltaFactor);
	SvgZoom(event.deltaY, p);
	// Zoom factor: 0.97/1.03
	return(false);
}

function SvgZoom(delta, p)
{
	// Use center if p not defined
	if (typeof(p) === 'undefined')
	{
		p = svgRoot.createSVGPoint();
		p.x = DimX / 2;
		p.y = DimY / 2;
	}
	// Zoom factor: 0.97/1.03
	var z = Math.pow(1 + sign(delta) * .1, Math.abs(delta));
    var g = svgRoot.getElementById('viewport');
	var ctm = g.getCTM().inverse();
	var scale = ctm.a;
	if ((delta < 0) && (z / scale < DimX / w1))
		z = DimX / w1 * scale; // Minimal zoom
	if ((delta > 0) && (z / scale > 1.0))
		z = 1.0 * scale; // Maximal zoom
	p = p.matrixTransform(ctm);
	// Compute new scale matrix in current mouse position
	var k = svgRoot.createSVGMatrix().translate(p.x, p.y).scale(z).translate(-p.x, -p.y);
	SvgSetGraphCtm(g.getCTM().multiply(k));
	// Update the matrix used for moving
	if (tfMoveZoom) tfMoveZoom = k.inverse().multiply(tfMoveZoom);
}

function SvgZoomIn()
{
	SvgZoom(1);
	return(false);
}

function SvgZoomOut()
{
	SvgZoom(-1);
	return(false);
}

function SvgResize()
{
	// Do not resize when not full size
	if ($('.svg-drawing-expand').length == 0) return;
	// Compute new size
	var _DimX = DimX;
	var _DimY = DimY;
	var _viewBoxX = viewBoxX;
	var _viewBoxY = viewBoxY;
	var _viewBoxW = viewBoxW;
	var _viewBoxH = viewBoxH;
	var _viewScale = viewScale;
	CalcBoundingBox();
	CalcViewBox();
	viewScale = _viewScale;
	if ((_DimX == DimX) && (_DimY == DimY)) return(true);
	// Change viewport size
	var g = svgPaper.canvas
	svgPaper.canvas = svgRoot;
	svgPaper.setSize(DimX, DimY);
	svgPaper.setViewBox(0, 0, viewBoxW, viewBoxH);
	svgPaper.canvas = g;
	// Move buttons
	var gbut1 = $('#buttons_group_1');
	if (gbut1.length > 0)
	{
		gbut1 = gbut1[0];
		var m = gbut1.getCTM();
		m = m.translate(DimX - _DimX, DimY - _DimY);
		// console.log('matrix(' + m.a + ',' + m.b + ',' + m.c + ',' + m.d + ',' + m.e + ',' + m.f + ') '+DimX+', '+DimY+' / '+_DimX+', '+_DimY);
		gbut1.setAttribute('transform', 'matrix(' + m.a + ',' + m.b + ',' + m.c + ',' + m.d + ',' + m.e + ',' + m.f + ')');
	}
	var gbut2 = $('#buttons_group_2');
	if (gbut2.length > 0)
	{
		gbut2 = gbut2[0];
		var m = gbut2.getCTM();
		m = m.translate(DimX - _DimX, 0)
		gbut2.setAttribute('transform', 'matrix(' + m.a + ',' + m.b + ',' + m.c + ',' + m.d + ',' + m.e + ',' + m.f + ')');
	}
	// Translate graph
	var g = svgRoot.getElementById('viewport');
	// var s = g.getCTM().translate((DimX - _DimX) / 2.0, (DimY - _DimY) / 2.0);
	var s = g.getCTM();
	s.e += (DimX - _DimX) / 2.0;
	s.f += (DimY - _DimY) / 2.0;
	// console.log((DimX - _DimX) / 2.0, (s.translate((DimX - _DimX) / 2.0, (DimY - _DimY) / 2.0)).e-s.e);
	SvgSetGraphCtm(s);
	return(false);
}

function getEventPoint(event)
{
	var p = svgRoot.createSVGPoint();
	var posX = $(svgRoot).offset().left;
	var posY = $(svgRoot).offset().top;
	p.x = event.pageX - posX;
	p.y = event.pageY - posY;
	// console.log(p.x, p.y);
	// p.x = event.clientX;
	// p.y = event.clientY;
	return p;
}


function SvgSetGraphCtm(matrix)
{
	var g = svgRoot.getElementById('viewport');
	// Limit matrix to bounding rect
	// console.log(matrix.a * x1 + matrix.e, matrix.a * (x1 + w1) + matrix.e - DimX);
	matrix.e -= Math.max(0, matrix.a * x1 + matrix.e);
	matrix.e -= Math.min(0, matrix.a * (x1 + w1) + matrix.e - DimX);
	matrix.f -= Math.max(0, matrix.a * y1 + matrix.f);
	matrix.f -= Math.min(0, matrix.a * (y1 + h1) + matrix.f - DimY);
	// Limit matrix to graph area
	if (matrix.a * x0 + matrix.e > 0)
		matrix.e -= Math.min(matrix.a * x0 + matrix.e, Math.max(0, matrix.a * (x0 + x0 + w0) / 2 + matrix.e - DimX / 2));
	if (matrix.a * (x0 + w0) + matrix.e < DimX)
		matrix.e -= Math.max(matrix.a * (x0 + w0) + matrix.e - DimX, Math.min(0, matrix.a * (x0 + x0 + w0) / 2 + matrix.e - DimX / 2));
	if (matrix.a * y0 + matrix.f > 0)
		matrix.f -= Math.min(matrix.a * y0 + matrix.f, Math.max(0, matrix.a * (y0 + y0 + h0) / 2 + matrix.f - DimY / 2));
	if (matrix.a * (y0 + h0) + matrix.f < DimY)
		matrix.f -= Math.max(matrix.a * (y0 + h0) + matrix.f - DimY, Math.min(0, matrix.a * (y0 + y0 + h0) / 2 + matrix.f - DimY / 2));
	// Set transform
	var s = 'matrix(' + matrix.a + ',' + matrix.b + ',' + matrix.c + ',' + matrix.d + ',' + matrix.e + ',' + matrix.f + ')';
	g.setAttribute('transform', s);
}


//==============================================================================
//=========================================== Keyboard events
//==============================================================================

var ctrlPressed = false;
var shiftPressed = false;

function SvgKeyDown(event)
{

    if (event.which == '17') ctrlPressed = true;
    if (event.which == '16') shiftPressed = true;
	return(true);
}

function SvgKeyUp(event)
{
    if (event.which == '17') ctrlPressed = false;
    if (event.which == '16') shiftPressed = false;
	return(true);
}


//==============================================================================
//==============================================================================
// Popup for each person
//==============================================================================
//==============================================================================


var svgPopupIdx = -1;

function SvgPopupHide()
{
	$('#svg-popup').hide();
}

function SvgPopupShow(x_elt, event)
{
	var elt = GetEltFromIndex(x_elt);
	var idx = elt.idx;
	if (idx < 0)
	{
		SvgPopupHide();
		return;
	}
	var fdx = (typeof(elt.fdx) === 'undefined') ? -1 : elt.fdx;
	$('#svg-popup').show();
	if (idx != svgPopupIdx)
	{
		var html = '<div class="popover-title">' + I(idx, 'name') + '</div>';
		html += '<div class="popover-content">';
		html += '* ' + I(idx, 'birth_date');
		if (I(idx, 'birth_place') != '') html += ' (' + I(idx, 'birth_place') + ')';
		if (fdx >= 0)
		{
			html += '<br>x ' + F(fdx, 'marr_date');
			if (F(fdx, 'marr_place') != '') html += ' (' + F(fdx, 'marr_place') + ')';
		}
		if (I(idx, 'death_date') != '')
		{
			html += '<br>+ ' + I(idx, 'death_date');
			if (I(idx, 'death_place') != '') html += ' (' + I(idx, 'death_place') + ')';
		}
		html += '</div>';
		$('#svg-popup').html(html);
		svgPopupIdx = idx;
	}
	SvgPopupMove(event);
}

function SvgPopupMove(event)
{
	var p = getEventPoint(event);
	var m = 10;
	p.x += m;
	p.y += m;
	if (p.x > DimX / 2) p.x -= $('#svg-popup').outerWidth(true) + 2 * m;
	if (p.y > DimY / 2) p.y -= $('#svg-popup').outerHeight(true) + 2 * m;
	$('#svg-popup').css('left', p.x);
	$('#svg-popup').css('top', p.y);
	return(true);
}


//==============================================================================
//==============================================================================
// Context menu
//==============================================================================
//==============================================================================

function SvgContextBefore($menu, event)
{
	var data = [];
	var x_elt = SvgGetElt(event.target);
	if (x_elt >= 0)
	{
		var elt = GetEltFromIndex(x_elt);
		var idx = elt.idx;
		if (idx >= 0)
		{
			// Person menu items
			data = data.concat([
				{header: I(idx, 'name'), href: Dwr.svgHref(idx)},
				{text: _('Person page'), href: Dwr.indiHref(idx)}
			]);
			var j, k, subm;
			// Spouses menu items
			subm = [];
			for (j = 0; j < I(idx, 'fams').length; j++)
			{
				var fdx = I(idx, 'fams')[j];
				for (k = 0; k < F(fdx, 'spou').length; k++)
				{
					if (F(fdx, 'spou')[k] == idx) continue;
					subm.push({
						text: I(F(fdx, 'spou')[k], 'name'),
						href: Dwr.svgHref(F(fdx, 'spou')[k])
					});
				}
			}
			if (subm.length > 0) data.push({
				text: _('Spouses'),
				subMenu: subm
			});
			// Siblings menu items
			subm = [];
			for (j = 0; j < I(idx, 'famc').length; j++)
			{
				var fdx = I(idx, 'famc')[j].index;
				for (k = 0; k < F(fdx, 'chil').length; k++)
				{
					if (F(fdx, 'chil')[k].index == idx) continue;
					subm.push({
						text: I(F(fdx, 'chil')[k].index, 'name'),
						href: Dwr.svgHref(F(fdx, 'chil')[k].index)
					});
				}
			}
			if (subm.length > 0) data.push({
				text: _('Siblings'),
				subMenu: subm
			});
			// Children menu items
			subm = [];
			for (j = 0; j < I(idx, 'fams').length; j++)
			{
				var fdx = I(idx, 'fams')[j];
				for (k = 0; k < F(fdx, 'chil').length; k++)
				{
					subm.push({
						text: I(F(fdx, 'chil')[k].index, 'name'),
						href: Dwr.svgHref(F(fdx, 'chil')[k].index)
					});
				}
			}
			if (subm.length > 0) data.push({
				text: _('Children'),
				subMenu: subm
			});
			// Parents menu items
			subm = [];
			for (j = 0; j < I(idx, 'famc').length; j++)
			{
				var fdx = I(idx, 'famc')[j].index;
				for (k = 0; k < F(fdx, 'spou').length; k++)
				{
					subm.push({
						text: I(F(fdx, 'spou')[k], 'name'),
						href: Dwr.svgHref(F(fdx, 'spou')[k])
					});
				}
			}
			if (subm.length > 0) data.push({
				text: _('Parents'),
				subMenu: subm
			});
		}
	}
	// if (data.length > 0) data = data.concat([{divider: true}]);
	// data = data.concat(svgContextMenuItems);
	if (data.length == 0) return(true);
	context.rebuild('#svg-drawing', data);
}


//==============================================================================
//==============================================================================
// Access to data
//==============================================================================
//==============================================================================

function getFams(idx)
{
	return(I(idx, 'fams'));
}
function getFamc(idx)
{
	var indexes = [];
	for (var x = 0; x < I(idx, 'famc').length; x++)
		indexes.push(I(idx, 'famc')[x].index);
	return(indexes);
}
function getSpou(fdx)
{
	var indexes = F(fdx, 'spou');
	for (var x = 0; x < indexes.length; x++)
	{
		var idx = indexes[x];
		UpdateDates(idx);
	}
	return(indexes);
}
function getChil(fdx)
{
	var indexes = [];
	for (var x = 0; x < F(fdx, 'chil').length; x++)
	{
		var idx = F(fdx, 'chil')[x].index;
		UpdateDates(idx);
		indexes.push(idx);
	}
	return(indexes);
}

function UpdateDates(idx)
{
	var b = parseInt(I(idx, 'birth_sdn'));
	var d = parseInt(I(idx, 'death_sdn'));
	var a = d - b;
	if (a > 0) maxAge = Math.max(maxAge, a);
	if (b > 0) minPeriod = Math.min(minPeriod, b);
	if (d > 0) maxPeriod = Math.max(maxPeriod, d);
}


//==============================================================================
//==============================================================================
// Preloading
//==============================================================================
//==============================================================================

DwrSvgClass.prototype.Preload = function()
{
	nbGenAsc = Dwr.search.Asc + 1;
	nbGenDsc = Dwr.search.Dsc + 1;
	nbGenAscFound = 0;
	nbGenDscFound = 0;
	maxAge = 0;
	minPeriod = 1e10;
	maxPeriod = -1e10;
	var preloadFuncs =
	[
		PreloadAsc,
		PreloadDsc,
		PreloadDscSpou,
		PreloadBoth,
		PreloadBothSpou
	];
	preloadFuncs[Dwr.search.SvgType]();
}

function PreloadAsc()
{
	GetElementsAsc();
}

function PreloadDsc()
{
	GetElementsDsc(false);
}

function PreloadDscSpou()
{
	GetElementsDsc(true);
}

function PreloadBoth()
{
	GetElementsAsc();
	GetElementsDsc(false);
}

function PreloadBothSpou()
{
	GetElementsAsc();
	GetElementsDsc(true);
}

function PreloadI(idx, launch)
{
	if (idx < 0) return;
	if (typeof(launch) === 'undefined') launch = true
	var scripts = Dwr.NameFieldScripts('I', idx, ['name', 'short_name', 'gender', 'birth_date', 'birth_sdn', 'birth_place', 'death_date', 'death_sdn', 'death_place', 'famc', 'fams']);
	if (!launch) return scripts;
	for (var j = 0; j < I(idx, 'fams').length; j++)
	{
		$.merge(scripts, PreloadF(I(idx, 'fams')[j], false));
	}
	for (var j = 0; j < I(idx, 'famc').length; j++)
	{
		$.merge(scripts, PreloadF(I(idx, 'famc')[j].index, false));
	}
	Dwr.PreloadScripts(scripts, true);
}

function PreloadF(fdx, launch)
{
	if (fdx < 0) return;
	if (typeof(launch) === 'undefined') launch = true
	var scripts = Dwr.NameFieldScripts('F', fdx, ['marr_date', 'marr_place', 'spou', 'chil']);
	for (var j = 0; j < F(fdx, 'spou').length; j++)
	{
		$.merge(scripts, PreloadI(F(fdx, 'spou')[j], false));
	}
	for (var j = 0; j < F(fdx, 'chil').length; j++)
	{
		$.merge(scripts, PreloadI(F(fdx, 'chil')[j].index, false));
	}
	if (!launch) return scripts;
	Dwr.PreloadScripts(scripts, true);
}


//==============================================================================
//==============================================================================
//=============================================== Create all eltsAsc elements
//==============================================================================
//==============================================================================

function GetElementsAsc()
{
	eltsAsc = [];
	GetElementsAscSub(Dwr.search.Idx, 0, -1);
}

function GetElementsAscSub(idx, lev, previous)
{
	PreloadI(idx);
	var elt = NewElt();
	elt.idx = idx;
	elt.lev = lev;
	elt.previous = previous;
	var x_elt = eltsAsc.length;
	eltsAsc.push(elt);
	nbGenAscFound = Math.max(nbGenAscFound, lev + 1);
	var i, j;
	if (lev < nbGenAsc - 1)
	{
		for (i = 0; i < getFamc(idx).length; i++)
		{
			var family = {
				fdx: getFamc(idx)[i],
				next: [],
				next_spou: []
			};
			elt.families.push(family);
			for (j = 0; j < getSpou(family.fdx).length; j++)
			{
				family.next.push(eltsAsc.length);
				var elt_next = GetElementsAscSub(getSpou(family.fdx)[j], lev + 1, x_elt);
			}
		}
	}
	return(elt);
}

function NewElt()
{
	return {
		idx: -1,
		families: [],
		previous: -1,
		isSpouse: false,
		ascending: true,
		lev: -1,
		// isSeparator: false,
		isCollapsed: false,
		shape: null,
		text: null,
		line: null
	};
}


//==============================================================================
//==============================================================================
//============================================== Create all eltsDsc elements
//==============================================================================
//==============================================================================


function GetElementsDsc(draw_spouses)
{
	eltsDsc = [];
	GetElementsDscSub(Dwr.search.Idx, 0, draw_spouses, -1);
}

function GetElementsDscSub(idx, lev, draw_spouses, previous)
{
	PreloadI(idx);
	var elt = NewElt();
	elt.idx = idx;
	elt.lev = lev;
	elt.previous = previous;
	var x_elt = eltsDsc.length;
	eltsDsc.push(elt);
	nbGenDscFound = Math.max(nbGenDscFound, lev + 1);
	if (lev < nbGenDsc - 1)
	{
		for (var f = 0; f < getFams(idx).length; f++)
		{
			var fdx = getFams(idx)[f];
			var family = {
				fdx: fdx,
				next: [],
				next_spou: []
			};
			elt.families.push(family);
			PreloadF(fdx);
			var previous_fam = x_elt;
			if (draw_spouses)
			{
				var found_spou = false;
				for (var i = 0; i < getSpou(fdx).length; i++)
				{
					if (idx != getSpou(fdx)[i])
					{
						family.next_spou.push(eltsDsc.length);
						GetElementsDscSubSpou(getSpou(fdx)[i], fdx, lev, draw_spouses, x_elt);
						found_spou = true;
					}
				}
				if (!found_spou)
				{
					// No spouse, create a fictive spouse to reserve space
					family.next_spou.push(eltsDsc.length);
					GetElementsDscSubSpou(-1, fdx, lev, draw_spouses, x_elt);
				}
				previous_fam = family.next_spou[0]
			}
			for (var i = 0; i < getChil(fdx).length; i++)
			{
				family.next.push(eltsDsc.length);
				var elt_next = GetElementsDscSub(getChil(fdx)[i], lev + 1, draw_spouses, previous_fam);
				elt_next.fdx_child = fdx;
			}
		}
	}
	return(elt);
}

function GetElementsDscSubSpou(idx, fdx, lev, draw_spouses, previous)
{
	PreloadF(fdx);
	PreloadI(idx);
	if (!draw_spouses) return;
	var elt = NewElt();
	elt.idx = idx;
	elt.lev = lev;
	elt.isSpouse = true
	elt.previous = previous;
	eltsDsc.push(elt);
	nbGenDscFound = Math.min(nbGenDsc, Math.max(nbGenDscFound, lev + 2));
	return(elt);
}


//==============================================================================
//==============================================================================
//======================================== Compute size allocated to each person
//==============================================================================
//==============================================================================


function ComputeElementsSizes()
{
	var computeElementsSizesFuncs =
	[
		ComputeElementsSizesAsc,
		ComputeElementsSizesDsc,
		ComputeElementsSizesDsc,
		ComputeElementsSizesBoth,
		ComputeElementsSizesBoth
	];
	computeElementsSizesFuncs[Dwr.search.SvgType]();
}

function ComputeElementsSizesAsc()
{
	szPeopleAsc = [];
	minSizeAsc = [];
	for (var i = 0; i <= nbGenAsc; i++)
	{
		szPeopleAsc[i] = 0;
		minSizeAsc[i] = 1e33;
	}
	ComputeElementsSizesSub(eltsAsc, szPeopleAsc, minSizeAsc, nbGenAscFound, 0, true, 0.0, 1.0);
}

function ComputeElementsSizesDsc()
{
	szPeopleDsc = [];
	minSizeDsc = [];
	for (var i = 0; i <= nbGenDsc; i++)
	{
		szPeopleDsc[i] = 0;
		minSizeDsc[i] = 1e33;
	}
	ComputeElementsSizesSub(eltsDsc, szPeopleDsc, minSizeDsc, nbGenDscFound, 0, true, 0.0, 1.0);
}

function ComputeElementsSizesBoth()
{
	ComputeElementsSizesAsc();
	ComputeElementsSizesDsc();

	// Compute homogeneous sizes for both ascending and descending trees
	var szMax = Math.max(eltsAsc[0].sz, eltsDsc[0].sz);
	function ApplyRatio(elts, nbGen, minSize)
	{
		var ratio = 1.0 * szMax / elts[0].sz;
		for (var i = 0; i < elts.length; i++)
		{
			elts[i].sz *= ratio;
			elts[i].po *= ratio;
		}
		for (var i = 0; i <= nbGen; i++) minSize[i] *= ratio;
	}
	ApplyRatio(eltsAsc, nbGenAsc, minSizeAsc);
	ApplyRatio(eltsDsc, nbGenDsc, minSizeDsc);
}

function ComputeElementsSizesSub(elts, szPeopleTable, minSizeTable, nbGens, x_elt, shown, po, sz)
{
	var elt = elts[x_elt];
	elt.shown = shown;
	elt.po = po;
	elt.ascending = (elts === eltsAsc);
	var circularShape = $.inArray(Dwr.search.SvgShape, [SVG_SHAPE_FULL_CIRCLE, SVG_SHAPE_HALF_CIRCLE, SVG_SHAPE_QUADRANT]) >= 0;
	var proportional = (Dwr.search.SvgDistribDsc == 0 || !circularShape);
	var next_shown = elt.shown && !elt.isCollapsed;
	elt.sz = sz;
	// Linked elements
	function ComputeLinkedElements(x_elts, po_elts, needChildSeparator, needFamilySeparator)
	{
		var sz_elts = 0;
		if (needFamilySeparator)
		{
			po_elts += SVG_SEPARATOR_SIZE;
			sz_elts += SVG_SEPARATOR_SIZE;
		}
		for (var i = 0; i < x_elts.length; i++)
		{
			if (needChildSeparator && i > 0)
			{
				po_elts += SVG_SEPARATOR_SIZE;
				sz_elts += SVG_SEPARATOR_SIZE;
			}
			var sz2 = ComputeElementsSizesSub(elts, szPeopleTable, minSizeTable, nbGens, x_elts[i], next_shown, po_elts, elt.sz / elt.families.length / x_elts.length);
			sz_elts += sz2;
			po_elts += sz2;
		}
		if (needFamilySeparator)
		{
			sz_elts += SVG_SEPARATOR_SIZE;
		}
		return sz_elts;
	}
	var sz_total = 0;
	var po_spou = elt.po;
	for (var f = 0; f < elt.families.length; f += 1)
	{
		var family = elt.families[f];
		// Check if separators are needed
		var needFamilySeparator = elt.families.length > 1 && !circularShape;
		var needChildSeparator = false;
		for (var i = 0; i < family.next.length; i++)
		{
			var x_next = family.next[i];
			var child = elts[x_next];
			if (child.families.length > 0)
			{
				needChildSeparator = true;
				break;
			}
		}
		needChildSeparator = needChildSeparator && !circularShape;
		// Linked spouses elements
		var sz_spou = ComputeLinkedElements(family.next_spou, elt.po + sz_total, false, needFamilySeparator);
		// Linked child/parents elements
		var sz_next = ComputeLinkedElements(family.next, elt.po + sz_total, needChildSeparator, needFamilySeparator);
		// Scale spouses to children
		if (family.next.length > 0 && family.next_spou.length > 0)
		{
			var sz2 = sz_next / family.next_spou.length;
			if (needFamilySeparator)
			{
				sz2 = (sz_next - 2 * SVG_SEPARATOR_SIZE) / family.next_spou.length;
				po_spou += SVG_SEPARATOR_SIZE;
			}
			for (var i = 0; i < family.next_spou.length; i++)
			{
				var spou = elts[family.next_spou[i]];
				spou.sz = sz2;
				spou.po = po_spou;
				po_spou	+= sz2;
			}
			if (needFamilySeparator)
			{
				po_spou += SVG_SEPARATOR_SIZE;
			}
		}
		sz_total += Math.max(sz_spou, sz_next);
	}
	// Element size
	if (!elt.shown)
	{
		// Element is not shown (i.e. linked to a collapsed element)
		elt.sz = 0.0;
	}
	else
{
		if (sz_total == 0 || elt.isCollapsed)
		{
			// Element has no linked element for next generation (parent / child / spouse)
			sz_total = 1.0;
			if (circularShape)
			{
				// For circular graphs, the element minimal size depends on the distance from the circle center
				sz_total = 1.0 * nbGens / (elt.lev + 1);
			}
		}
		if (proportional)
		{
			// When propotional, the size depends on the number of elements for the next generation
			elt.sz = sz_total;
			szPeopleTable[elt.lev] += elt.sz;
		}
		else
		{
			szPeopleTable[elt.lev] = 1.0;
		}
		minSizeTable[elt.lev] = Math.min(minSizeTable[elt.lev], elt.sz);
	}
	return elt.sz;
}


//==============================================================================
//==============================================================================
//========================================================= Width of the circles
//==============================================================================
//==============================================================================

// These functions compute the width of the circles for each generation

function ComputeRays()
{
	var circularShape = $.inArray(Dwr.search.SvgShape, [SVG_SHAPE_FULL_CIRCLE, SVG_SHAPE_HALF_CIRCLE, SVG_SHAPE_QUADRANT]) >= 0;
	if (!circularShape) return;
	var computeRaysFuncs =
	[
		ComputeRaysAsc,
		ComputeRaysDsc,
		ComputeRaysDscSpou,
		ComputeRaysBoth,
		ComputeRaysBothSpou
	];
	var angles =[
		0, 0, 0, 0,
		2.0 * Math.PI,
		Math.PI + 2 * hemiA,
		Math.PI / 2 + 2 * hemiA
		
	];
	var angle = angles[Dwr.search.SvgShape];
	computeRaysFuncs[Dwr.search.SvgType](angle);
}

function ComputeRaysAsc(angle)
{
	ComputeRaysPropSub(eltsAsc[0], szPeopleAsc, nbGenAscFound, false);
	ComputeCircularStrokeWidth(angle, eltsAsc[0], minSizeAsc, nbGenAscFound);
	maxTextWidth = coordX * rayons[0] * 2;
}

function ComputeRaysDsc(angle)
{
	ComputeRaysPropSub(eltsDsc[0], szPeopleDsc, nbGenDscFound, false);
	ComputeCircularStrokeWidth(angle, eltsDsc[0], minSizeDsc, nbGenDscFound);
	maxTextWidth = coordX * rayons[0] * 2;
}

function ComputeRaysDscSpou(angle)
{
	ComputeRaysPropSub(eltsDsc[0], szPeopleDsc, nbGenDscFound, true);
	ComputeCircularStrokeWidth(angle, eltsDsc[0], minSizeDsc, nbGenDscFound);
	maxTextWidth = coordX * rayons[0] * 2;
}

function ComputeRaysBoth(angle)
{
	ComputeRaysBothSub(false);
	rayons = rayonsAsc;
	ComputeCircularStrokeWidth(Math.PI, eltsAsc[0], minSizeAsc, nbGenAscFound);
	maxTextWidth = coordX * rayons[0] * 2;
	rayons = rayonsDsc;
	ComputeCircularStrokeWidth(Math.PI, eltsDsc[0], minSizeDsc, nbGenDscFound);
	maxTextWidth = Math.min(maxTextWidth, coordX * rayons[0] * 2);
	rayons = null;
}

function ComputeRaysBothSpou(angle)
{
	ComputeRaysBothSub(true);
}

function ComputeRaysBoth(angle)
{
	ComputeRaysBothSub(false);
}

function ComputeRaysBothSub(draw_spouses)
{
	ComputeRaysPropSub(eltsAsc[0], szPeopleAsc, nbGenAscFound, false);
	ComputeCircularStrokeWidth(Math.PI, eltsAsc[0], minSizeAsc, nbGenAscFound);
	maxTextWidth = coordX * rayons[0] * 2;
	rayonsAsc = rayons;
	ComputeRaysPropSub(eltsDsc[0], szPeopleDsc, nbGenDscFound, draw_spouses);
	ComputeCircularStrokeWidth(Math.PI, eltsDsc[0], minSizeDsc, nbGenDscFound);
	maxTextWidth = Math.min(maxTextWidth, coordX * rayons[0] * 2);
	rayonsDsc = rayons;
	rayons = null;
	var nb_gen = Math.max(nbGenAscFound, nbGenDscFound);
	for (var i = 0 ; i < nb_gen; i++)
	{
		var r_dsc = rayonsDsc[i];
		if (i >= nbGenAscFound) rayonsAsc[i] = rayonsDsc[i];
		else if (i >= nbGenDscFound) rayonsDsc[i] = rayonsAsc[i];
		else if (rayonsAsc[i] < r_dsc) rayonsDsc[i] = rayonsAsc[i];
		else rayonsAsc[i] = rayonsDsc[i];
	}
	if (draw_spouses)
	{
		var offset = 0;
		for (var i = 0 ; i < nbGenAscFound; i++)
		{
			if (i < nbGenAscFound - 1) offset = (rayonsAsc[i + 1] - rayonsAsc[i]) / 2;
			else if (i < nbGenDscFound - 1) offset = (rayonsDsc[i + 1] - rayonsDsc[i]) / 2;
			rayonsAsc[i] += offset;
		}
		var ratio = Math.min(1.0, 1.0 / rayonsAsc[nbGenAscFound - 1]);
		for (var i = 0 ; i < nb_gen; i++)
		{
			rayonsAsc[i] *= ratio;
			rayonsDsc[i] *= ratio;
		}
	}
}

function ComputeRaysPropSub(center_elt, nb_people, nb_gen, draw_spouses)
{
	var ofst = 0;
	if (Dwr.search.SvgShape == SVG_SHAPE_QUADRANT)
	{
		nb_gen += 1;
		nb_people[-1] = 1;
		ofst = -1;
	}
	var i;
	rayons = [];
	rayons[0 + ofst] = 0.5;
	for (i = 1 + ofst; i <= nb_gen + ofst; i++)
	{
		rayons[i] = 2.0 * Math.PI * rayons[i-1] * txtRatioMax * nb_people[i] / center_elt.sz;
		if (rayons[i] > 1) rayons[i] = 1.0;
		if (draw_spouses && i == nb_gen + ofst) rayons[i] /= 2.0;
		rayons[i] += rayons[i-1];
	}
	for (i = 0 + ofst; i <= nb_gen + ofst; i++)
	{
		rayons[i] /= rayons[nb_gen + ofst];
	}
}

function ComputeCircularStrokeWidth(angle, center_elt, minSizeTable, nb_gens)
{
	// Compute the stroke-width depending on box size
	for (var i = 0; i < nb_gens; i++)
	{
		svgStroke = Math.min(svgStroke, coordX * rayons[i] * angle * minSizeTable[i] / center_elt.sz / svgStrokeRatio);
	}
}

//==============================================================================
//==============================================================================
//=============================================================== Circular trees 
//==============================================================================
//==============================================================================

function DrawCircularSub(elts, x_elt, a0, b0, draw_spouses)
{
	var elt = elts[x_elt];
	if (elt.idx < 0) return;
	var a = a0 + (b0 - a0) / elts[0].sz * elt.po;
	var b = a + (b0 - a0) / elts[0].sz * elt.sz;
	if (x_elt == 0)
	{
		if (Dwr.search.SvgShape == SVG_SHAPE_FULL_CIRCLE)
		{
			CenterCircle(x_elt, elt, rayons[0]);
		}
		if (Dwr.search.SvgShape == SVG_SHAPE_HALF_CIRCLE)
		{
			CenterCircleHemi(x_elt, elt, rayons[0], a0, b0);
		}
		if (Dwr.search.SvgShape == SVG_SHAPE_QUADRANT)
		{
			Sector(x_elt, elt, a0, b0, rayons[elt.lev - 1], rayons[elt.lev]);
		}
	}
	else if (elt.ascending)
	{
		Sector(x_elt, elt, a, b, rayons[elt.lev - 1], rayons[elt.lev]);
	}
	else if (elt.isSpouse)
	{
		Sector(x_elt, elt, a, b, rayons[elt.lev], (rayons[elt.lev] + rayons[elt.lev + 1]) / 2);
	}
	else if (draw_spouses)
	{
		Sector(x_elt, elt, a, b, (rayons[elt.lev] + rayons[elt.lev - 1]) / 2, rayons[elt.lev]);
	}
	else
	{
		Sector(x_elt, elt, a, b, rayons[elt.lev - 1], rayons[elt.lev]);
	}
}


//=========================================== Full circle
function InitCircle()
{
	x0 = -(coordX + margeX);
	y0 = -(coordY + margeY);
	w0 = 2 * (coordX + margeX);
	h0 = 2 * (coordY + margeY);
}

function DrawCircle(elts, x_elt)
{
	DrawCircularSub(elts, x_elt, 0.0, 2.0 * Math.PI, false);
}


//=========================================== Half circle
function InitHemi()
{
	x0 = -(coordX + margeX);
	y0 = -(coordY + margeY);
	w0 = 2 * (coordX + margeX);
	h0 = coordY * (1 + Math.sin(hemiA)) + 2 * margeY;
}

function DrawHemi(elts, x_elt)
{
	DrawCircularSub(elts, x_elt, -Math.PI/2 - hemiA, Math.PI/2 + hemiA, false);
}


//=========================================== Quadrant
function InitQadr()
{
	var over =  Math.sin(hemiA);
	x0 = -(coordX * over + margeX);
	y0 = -(coordY + margeY);
	w0 = coordX * (1 + over) + 2 * margeX;
	h0 = coordY * (1 + over) + 2 * margeY;
}

function DrawQadr(elts, x_elt)
{
	DrawCircularSub(elts, x_elt, -hemiA, Math.PI/2 + hemiA, false);
}


//==============================================================================
//==============================================================================
//======================================== Descending ircular trees with spouses
//==============================================================================
//==============================================================================

function DrawCircleSpou(elts, x_elt)
{
	DrawCircularSub(elts, x_elt, 0.0, 2.0 * Math.PI, true);
}

function DrawHemiSpou(elts, x_elt)
{
	DrawCircularSub(elts, x_elt, -Math.PI/2 - hemiA, Math.PI/2 + hemiA, true);
}

function DrawQadrSpou(elts, x_elt)
{
	DrawCircularSub(elts, x_elt, -hemiA, Math.PI/2 + hemiA, true);
}


//==============================================================================
//==============================================================================
//====================================== Ascending and descending circular trees 
//==============================================================================
//==============================================================================

function DrawCircleBothSub(elts, x_elt, draw_spouses)
{
	var elt = elts[x_elt];
	if (x_elt == 0)
	{
		if (elt.ascending)
		{
			CenterCircleBoth(x_elt, elt, rayonsAsc[0], rayonsDsc[0]);
		}
	}
	else
	{
		if (elt.ascending)
		{
			rayons = rayonsAsc;
			DrawCircularSub(elts, x_elt, -Math.PI / 2, Math.PI / 2, draw_spouses);
		}
		else
		{
			rayons = rayonsDsc;
			DrawCircularSub(elts, x_elt, Math.PI / 2, 3 * Math.PI / 2, draw_spouses);
		}
	}
}

function DrawCircleBoth(elts, x_elt)
{
	DrawCircleBothSub(elts, x_elt, false);
}

function DrawCircleBothSpou(elts, x_elt)
{
	DrawCircleBothSub(elts, x_elt, true);
}


//==============================================================================
//==============================================================================
//============================================================== Horizontal tree
//==============================================================================
//==============================================================================

function DrawTreeHRect(x_elt, elt, x, y, w, h)
{
	if (Dwr.search.SvgShape != SVG_SHAPE_HORIZONTAL_RL)
	{
		x = w0 - 2.0 * margeX - x - w;
	}
	Rectangle(x_elt, elt, x, y, w, h);
}

function DrawTreeHLine(x_elt, elt, x1, y1, x2, y2)
{
	if (Dwr.search.SvgShape != SVG_SHAPE_HORIZONTAL_RL)
	{
		x1 = w0 - 2.0 * margeX - x1;
		x2 = w0 - 2.0 * margeX - x2;
	}
	Line(elt, x1, y1, x2, y2);
}

function DrawTreeHSub(elts, x_elt, nb_gens, draw_spouses, draw_center, offsetx)
{
	var elt = elts[x_elt];
	if (elt.idx < 0) return;
	var box_width = Math.min(coordX / nb_gens, coordY / elts[0].sz * txtRatioMax);
	var box_height = Math.min(box_width / txtRatioMin, elt.sz * box_width / txtRatioMax);
	if (elt.ascending)
	{
		var x = box_width * (1.0 + linkRatio) * (elt.lev + offsetx);
		var y = (elt.po + elt.sz / 2.0) * box_width / txtRatioMax;
		if (elt.previous >= 0)
		{
			// Draw links
			var previous_elt = elts[elt.previous];
			var previous_x = box_width * (1.0 + linkRatio) * (previous_elt.lev + offsetx) + box_width;
			var previous_y = (previous_elt.po + previous_elt.sz / 2.0) * box_width / txtRatioMax;
			DrawTreeHLine(x_elt, elt, previous_x, previous_y, x, y);
		}
		DrawTreeHRect(x_elt, elt, x, y - box_height / 2.0, box_width, box_height);
	}
	else if (elt.isSpouse)
	{
		var x = box_width * (1.0 + linkRatio) * (offsetx - elt.lev * 2) - box_width * (1.0 + linkRatio);
		var y = (elt.po + elt.sz / 2.0) * box_width / txtRatioMax;
		if (elt.previous >= 0)
		{
			// Draw links
			var previous_elt = elts[elt.previous];
			var previous_x = box_width * (1.0 + linkRatio) * (offsetx - previous_elt.lev * 2);
			var previous_y = (previous_elt.po + previous_elt.sz / 2.0) * box_width / txtRatioMax;
			DrawTreeHLine(x_elt, elt, previous_x, previous_y, x + box_width, y);
		}
		DrawTreeHRect(x_elt, elt, x, y - box_height / 2.0, box_width, box_height);
	}
	else
	{
		var x = box_width * (1.0 + linkRatio) * (offsetx - elt.lev * (draw_spouses ? 2 : 1));
		var y = (elt.po + elt.sz / 2.0) * box_width / txtRatioMax;
		if (elt.previous >= 0)
		{
			// Draw links
			var previous_elt = elts[elt.previous];
			var previous_x = box_width * (1.0 + linkRatio) * (offsetx - previous_elt.lev);
			if (draw_spouses)
				previous_x = box_width * (1.0 + linkRatio) * (offsetx - previous_elt.lev * 2) - box_width * (1.0 + linkRatio);
			var previous_y = (previous_elt.po + previous_elt.sz / 2.0) * box_width / txtRatioMax;
			DrawTreeHLine(x_elt, elt, previous_x, previous_y, x + box_width, y);
		}
		if (draw_center || elt.lev > 0)
			DrawTreeHRect(x_elt, elt, x, y - box_height / 2.0, box_width, box_height);
	}
}

//=========================================== Tree ascending
function InitAscTreeH()
{
	var box_width = Math.min(coordX / nbGenAscFound, coordY / eltsAsc[0].sz * txtRatioMax);
	var box_height = box_width / txtRatioMax;
	maxTextWidth = box_width;
	x0 = -margeX;
	y0 = -margeY;
	w0 = box_width * nbGenAscFound + box_width * (nbGenAscFound - 1) * linkRatio + 2.0 * margeX;
	h0 = box_height * eltsAsc[0].sz + 2.0 * margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_height / svgStrokeRatio);
}

function DrawAscTreeH(elts, x_elt)
{
	DrawTreeHSub(elts, x_elt, nbGenAscFound, false, true, 0);
}

//=========================================== Tree descending
function InitDscTreeH()
{
	var box_width = Math.min(coordX / nbGenDscFound, coordY / eltsDsc[0].sz * txtRatioMax);
	var box_height = box_width / txtRatioMax;
	maxTextWidth = box_width;
	x0 = -margeX;
	y0 = -margeY;
	w0 = box_width * nbGenDscFound + box_width * (nbGenDscFound - 1) * linkRatio + 2.0 * margeX;
	h0 = box_height * eltsDsc[0].sz + 2.0 * margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_height / svgStrokeRatio);
}

function DrawDscTreeH(elts, x_elt)
{
	DrawTreeHSub(elts, x_elt, nbGenDscFound, false, true, nbGenDscFound - 1);
}

//=========================================== Tree descending with spouse
function InitDscTreeHSpou()
{
	var nb_gens = nbGenDscFound * 2 - 1;
	var box_width = Math.min(coordX / nb_gens, coordY / eltsDsc[0].sz * txtRatioMax);
	var box_height = box_width / txtRatioMax;
	maxTextWidth = box_width;
	x0 = -margeX;
	y0 = -margeY;
	w0 = box_width * nb_gens + box_width * (nb_gens - 1) * linkRatio + 2.0 * margeX;
	h0 = box_height * eltsDsc[0].sz + 2.0 * margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_height / svgStrokeRatio);
}

function DrawDscTreeHSpou(elts, x_elt)
{
	var nb_gens = nbGenDscFound * 2 - 1;
	DrawTreeHSub(elts, x_elt, nb_gens, true, true, nb_gens - 1);
}

//=========================================== Tree ascending + descending

function InitBothTreeHSub(draw_spouses)
{
	var nb_gens = nbGenAscFound + (draw_spouses ? (nbGenDscFound * 2 - 1) : nbGenDscFound) - 1;
	var box_width = Math.min(coordX / nb_gens, coordY / eltsAsc[0].sz * txtRatioMax);
	var box_height = box_width / txtRatioMax;
	maxTextWidth = box_width;
	x0 = -margeX;
	y0 = -margeY;
	w0 = box_width * nb_gens + box_width * (nb_gens - 1) * linkRatio + 2.0 * margeX;
	h0 = box_height * eltsAsc[0].sz + 2.0 * margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_height / svgStrokeRatio);
}

function InitBothTreeH()
{
	InitBothTreeHSub(false);
}

function DrawBothTreeH(elts, x_elt)
{
	var nb_gens = nbGenAscFound + nbGenDscFound - 1;
	DrawTreeHSub(elts, x_elt, nb_gens, false, false, nb_gens - nbGenAscFound);
}

function InitBothTreeHSpou()
{
	InitBothTreeHSub(true);
}

function DrawBothTreeHSpou(elts, x_elt)
{
	var nb_gens = nbGenAscFound + nbGenDscFound * 2 - 2;
	DrawTreeHSub(elts, x_elt, nb_gens, true, false, nbGenDscFound * 2 - 2);
}


//==============================================================================
//==============================================================================
//================================================================ Vertical tree
//==============================================================================
//==============================================================================

function DrawTreeVRect(x_elt, elt, x, y, w, h)
{
	if (Dwr.search.SvgShape == SVG_SHAPE_VERTICAL_BT)
	{
		y = h0 - 2.0 * margeY - y - h;
	}
	Rectangle(x_elt, elt, x, y, w, h);
}

function DrawTreeVLine(x_elt, elt, x1, y1, x2, y2)
{
	if (Dwr.search.SvgShape == SVG_SHAPE_VERTICAL_BT)
	{
		y1 = h0 - 2.0 * margeY - y1;
		y2 = h0 - 2.0 * margeY - y2;
	}
	Line(elt, x1, y1, x2, y2);
}

function DrawTreeVSub(elts, x_elt, nb_gens, draw_spouses, draw_center, offsety)
{
	var elt = elts[x_elt];
	if (elt.idx < 0) return;
	var box_height = Math.min(coordY / nb_gens, coordX / elts[0].sz / txtRatioMin);
	var box_width = Math.min(box_height * txtRatioMax, elt.sz * box_height * txtRatioMin);
	if (elt.ascending)
	{
		var y = box_height * (1.0 + linkRatio) * (offsety - elt.lev);
		var x = (elt.po + elt.sz / 2.0) * coordX / elts[0].sz;
		if (elt.previous >= 0)
		{
			// Draw links
			var previous_elt = elts[elt.previous];
			var previous_y = box_height * (1.0 + linkRatio) * (offsety - previous_elt.lev);
			var previous_x = (previous_elt.po + previous_elt.sz / 2.0) * coordX / elts[0].sz;
			DrawTreeVLine(x_elt, elt, previous_x, previous_y, x, y + box_height);
		}
		DrawTreeVRect(x_elt, elt, x - box_width / 2.0, y, box_width, box_height);
	}
	else if (elt.isSpouse)
	{
		var y = box_height * (1.0 + linkRatio) * (elt.lev * (draw_spouses ? 2 : 1) + offsety) + box_height * (1.0 + linkRatio);
		var x = (elt.po + elt.sz / 2.0) * coordX / elts[0].sz;
		if (elt.previous >= 0)
		{
			// Draw links
			var previous_elt = elts[elt.previous];
			var previous_y = box_height * (1.0 + linkRatio) * (previous_elt.lev * (draw_spouses ? 2 : 1) + offsety) + box_height;
			var previous_x = (previous_elt.po + previous_elt.sz / 2.0) * coordX / elts[0].sz;
			DrawTreeVLine(x_elt, elt, previous_x, previous_y, x, y);
		}
		DrawTreeVRect(x_elt, elt, x - box_width / 2.0, y, box_width, box_height);
	}
	else
	{
		var y = box_height * (1.0 + linkRatio) * (elt.lev * (draw_spouses ? 2 : 1) + offsety);
		var x = (elt.po + elt.sz / 2.0) * coordX / elts[0].sz;
		if (elt.previous >= 0)
		{
			// Draw links
			var previous_elt = elts[elt.previous];
			var previous_y = box_height * (1.0 + linkRatio) * (previous_elt.lev * (draw_spouses ? 2 : 1) + offsety) + box_height;
			var previous_x = (previous_elt.po + previous_elt.sz / 2.0) * coordX / elts[0].sz;
			if (draw_spouses)
				previous_y = box_height * (1.0 + linkRatio) * (previous_elt.lev * (draw_spouses ? 2 : 1) + offsety) + box_height * (1.0 + linkRatio) + box_height;
			DrawTreeVLine(x_elt, elt, previous_x, previous_y, x, y);
		}
		if (draw_center || elt.lev > 0)
			DrawTreeVRect(x_elt, elt, x - box_width / 2.0, y, box_width, box_height);
	}
}


//=========================================== Arbre vertical ascendant

function InitAscTreeV()
{
	var box_height = Math.min(coordY / nbGenAscFound, coordX / eltsAsc[0].sz / txtRatioMin);
	var box_width = box_height * txtRatioMin;
	maxTextWidth = box_width;
	// Space reserved for links between boxes
	var h = box_height * nbGenAscFound + 2.0 * margeX; // total height
	linkRatio = Math.max(linkRatio,
		(coordY - h) / (nbGenAscFound - 1) / box_height
	);
	// Size of the canvas
	w0 = box_width * eltsAsc[0].sz + 2.0 * margeX;
	h0 = box_height * nbGenAscFound + box_height * (nbGenAscFound - 1) * linkRatio + 2.0 * margeY;
	x0 = -margeX;
	y0 = -margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_width / svgStrokeRatio);
}

function DrawAscTreeV(elts, x_elt)
{
	DrawTreeVSub(elts, x_elt, nbGenAscFound, false, true, nbGenAscFound - 1);
}

//=========================================== Arbre vertical descendant

function InitDscTreeV()
{
	var box_height = Math.min(coordY / nbGenDscFound, coordX / eltsDsc[0].sz / txtRatioMin);
	var box_width = box_height * txtRatioMin;
	maxTextWidth = box_width;
	// Space reserved for links between boxes
	var h = box_height * nbGenDscFound + 2.0 * margeY; // total height
	linkRatio = Math.max(linkRatio,
		(Math.min(coordY, coordX * DimY / DimX) - h) / (nbGenDscFound - 1) / box_height
	);
	// Size of the canvas
	w0 = box_width * eltsDsc[0].sz + 2.0 * margeX;
	h0 = box_height * nbGenDscFound + box_height * (nbGenDscFound - 1) * linkRatio + 2.0 * margeY;
	x0 = -margeX;
	y0 = -margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_width / svgStrokeRatio);
}

function DrawDscTreeV(elts, x_elt)
{
	DrawTreeVSub(elts, x_elt, nbGenDscFound, false, true, 0);
}

//=========================================== Arbre vertical descendant avec epoux

function InitDscTreeVSpou()
{
	var nb_gens = nbGenDscFound * 2 - 1;
	var box_height = Math.min(coordY / nb_gens, coordX / eltsDsc[0].sz / txtRatioMin);
	var box_width = box_height * txtRatioMin;
	maxTextWidth = box_width;
	// Space reserved for links between boxes
	var h = box_height * nb_gens + 2.0 * margeY; // total height
	linkRatio = Math.max(linkRatio,
		(Math.min(coordY, coordX * DimY / DimX) - h) / (nb_gens - 1) / box_height
	);
	// Size of the canvas
	w0 = box_width * eltsDsc[0].sz + 2.0 * margeX;
	h0 = box_height * nb_gens + box_height * (nb_gens - 1) * linkRatio + 2.0 * margeY;
	x0 = -margeX;
	y0 = -margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_width / svgStrokeRatio);
}

function DrawDscTreeVSpou(elts, x_elt)
{
	var nb_gens = nbGenDscFound * 2 - 1;
	DrawTreeVSub(elts, x_elt, nb_gens, true, true, 0);
}


//=========================================== Arbre vertical ascendant+descendant

function InitBothTreeVSub(draw_spouses)
{
	var nb_gens = nbGenAscFound + (draw_spouses ? (nbGenDscFound * 2 - 1) : nbGenDscFound) - 1;
	var box_height = Math.min(coordY / nb_gens, coordX / eltsAsc[0].sz / txtRatioMin);
	var box_width = box_height * txtRatioMin;
	maxTextWidth = box_width;
	// Space reserved for links between boxes
	var h = box_height * nb_gens + 2.0 * margeY; // total height
	linkRatio = Math.max(linkRatio,
		(Math.min(coordY, coordX * DimY / DimX) - h) / (nb_gens - 1) / box_height
	);
	// Size of the canvas
	w0 = box_width * eltsAsc[0].sz + 2.0 * margeX;
	h0 = box_height * nb_gens + box_height * (nb_gens - 1) * linkRatio + 2.0 * margeY;
	x0 = -margeX;
	y0 = -margeY;
	// Compute the stroke-width depending on box size
	svgStroke = Math.min(svgStroke, box_width / svgStrokeRatio);
}

function InitBothTreeV()
{
	InitBothTreeVSub(false);
}

function DrawBothTreeV(elts, x_elt)
{
	var nb_gens = nbGenAscFound + nbGenDscFound - 1;
	DrawTreeVSub(elts, x_elt, nb_gens, false, false, nbGenAscFound - 1);
}

function InitBothTreeVSpou()
{
	InitBothTreeVSub(true);
}

function DrawBothTreeVSpou(elts, x_elt)
{
	var nb_gens = nbGenAscFound + nbGenDscFound * 2 - 2;
	DrawTreeVSub(elts, x_elt, nb_gens, true, false, nbGenAscFound - 1);
}


//==============================================================================
//==============================================================================
//================================================================ Basic drawing
//==============================================================================
//==============================================================================

function CenterCircle(x_elt, elt, r)
{
	var x = r * coordX * 0.87;
	var y = r * coordY * 0.5;
	if (elt.text === null)
	{
		// Create center for Circle graphs
		elt.shape = svgPaper.circle(0, 0, r * coordX);
		// Create text
		TextRect(x_elt, elt, -x, -y, x, y);
		// Build the SVG elements style
		SvgSetStyle(x_elt, elt);
	}
	else
	{
		if (elt.shown)
		{
			// Modify circle
			elt.shape.attr('cx', 0);
			elt.shape.attr('cx', 0);
			elt.shape.attr('r', r * coordX);
			elt.shape.show();
			// Modify text
			TextRect(x_elt, elt, -x, -y, x, y);
		}
	}
	elt.shapeAnimation = {transform: 's' + animationZoom + ' ' + animationZoom};
	elt.shapeAnimationReset = {transform: ''};
}

function CenterCircleHemi(x_elt, elt, r, a1, a2)
{
	var ap = 'M ' + (coordX * r * Math.sin(a1)) + ',' + (-coordY * r * Math.cos(a1)) +
			ArcPath(r,a1,a2,1) +
			' z';
	// Compute text position
	var x = r * coordX * 0.87;
	var y = r * coordY * 0.5;
	var y2 = r * coordY * Math.sin(hemiA);
	if (elt.text === null)
	{
		// Create center for CircleHemi graphs
		elt.shape = svgPaper.path(ap);
		// Create text
		TextRect(x_elt, elt, -x, -y, x, Math.min(y, y2));
		// Build the SVG elements style
		SvgSetStyle(x_elt, elt);
	}
	else
	{
		if (elt.shown)
		{
			// Modify shape
			elt.shape.attr('path', ap);
			elt.shape.show();
			// Modify text
			TextRect(x_elt, elt, -x, -y, x, Math.min(y, y2));
		}
	}
	elt.shapeAnimation = {transform: 's' + animationZoom + ' ' + animationZoom};
	elt.shapeAnimationReset = {transform: ''};
}

function CenterCircleBoth(x_elt, elt, r1, r2)
{
	// Compute center for CircleBoth graphs
	var ap = 'M ' + (-coordX * r1) + ',' + 0 +
			ArcPath(r1, -Math.PI/2, Math.PI/2, 1) +
			' L ' + (coordX * r2) + ',' + 0 +
			ArcPath(r2, Math.PI/2, 3*Math.PI/2, 1) +
			' z';
	// Compute text position
	var x = coordX * Math.min(r1, r2) * 0.87;
	var y = coordX * Math.min(r1, r2) * 0.5;
	if (elt.text === null)
	{
		// Create center for CircleBoth graphs
		elt.shape = svgPaper.path(ap);
		// Create text
		TextRect(x_elt, elt, -x, -y, x, y);
		// Build the SVG elements style
		SvgSetStyle(x_elt, elt);
	}
	else
	{
		if (elt.shown)
		{
			// Modify shape
			elt.shape.attr('path', ap);
			elt.shape.show();
			// Modify text
			TextRect(x_elt, elt, -x, -y, x, y);
		}
	}
	elt.shapeAnimation = {transform: 's' + animationZoom + ' ' + animationZoom};
	elt.shapeAnimationReset = {transform: ''};
}

function Line(elt, x1, y1, x2, y2)
{
	if (elt.line === null)
	{
		elt.line = svgPaper.path(['M', x1, y1, 'L', x2, y2].join(','));
		elt.line.node.setAttribute('class', 'svg-line');
		elt.line.attr('stroke-width', svgStroke);
	}
	else
	{
		if (elt.shown)
		{
			elt.line.attr('path', ['M', x1, y1, 'L', x2, y2].join(','));
			elt.line.show();
		}
	}
}

function CalcTextTab(tab, n)
{
	var i, j, l = tab.length;
	if (l <= n)
	{
		var t = $.extend(true, [], tab); // Deep copy
		for (i=l; i<n; i++) t[i] = '';
		return(t);
	}
	j = 0;
	for (i = 0; i < l; i++) j = Math.max(j, tab[i].length);
	NEWSZ:for (; j<1000; j++)
	{
		var t = [];
		for (i = 0; i < n; i++) t[i] = '';
		var o = 0;
		for (i = 0; i < l; i++)
		{
			if (tab[i].length > j) continue NEWSZ;
			if (tab[i].length + t[o].length >= j)
			{
				o++;
				if (o >= n) continue NEWSZ;
				t[o] = tab[i];
			}
			else
			{
				t[o] += ' ' + tab[i];
			}
		}
		return(t);
	}
}

function calcTextTabSize(tab, n)
{
	tab = CalcTextTab(tab, n);
	var i, size = 0;
	for (i = 0; i < tab.length; i++)
	{
		size = Math.max(size, tab[i].length);
	}
	return(size);
}

function TextLine(x_elt, elt, x, y, w, h, a, txt)
{
	// Orient the text
	if (w < h)
	{
		var tmp = w;
		w = h;
		h = tmp;
		a += Math.PI / 2;
	}
	a = a % (2 * Math.PI);
	if (a > Math.PI / 2 && a < 3 * Math.PI / 2) a = (a + Math.PI) % (2 * Math.PI);
	//
	var transform;
	if (elt.text === null)
	{
		// Calcul de la taille de police et des lignes
		var tab = txt.split(/[ \-]+/g);
		var fs = 0;
		var i, fi = 0;
		for (i = 0; i < tab.length; i++)
		{
			var size = calcTextTabSize(tab, i+1);
			var nfs = Math.round(Math.min(fontFactorX * w / size, fontFactorY * h / (i+1)));
			nfs = Math.min(nfs, Math.round(maxTextWidth * fontFactorX / txtRatioMax));
			if (nfs > fs)
			{
				fs = nfs;
				fi = i;
			}
		}
		tab = CalcTextTab(tab, fi+1);
		txt = tab.join('\n');
		// Dessin
		elt.text = svgPaper.text(x, y, txt);
		var fs0 = Math.max(10, Math.round(20 / viewScale));
		elt.text.attr('font', '');
		elt.text.attr('font-size', '' + fs0);
		elt.textBbox = elt.text.getBBox();
		var fs = Math.min(w / elt.textBbox.width, h / elt.textBbox.height);
		chromeBugBBox(elt.text);
		elt.text.transform('r' + a * 180 / Math.PI);
		elt.text.scale(fs , fs);
		transform = elt.text.transform();
	}
	else
	{
		if (elt.shown)
		{
			elt.text.attr('x', x);
			elt.text.attr('y', y);
			var fs = Math.min(w / elt.textBbox.width, h / elt.textBbox.height);
			elt.text.transform('r' + a * 180 / Math.PI);
			elt.text.scale(fs , fs);
			elt.text.show();
		}
		transform = elt.text.transform();
	}
	elt.textAnimation = {transform: transform + 's' + animationZoom + ' ' + animationZoom};
	elt.textAnimationReset = {transform: transform};
}

function chromeBugBBox(text)
{
	// Chrome bug workaround (https://github.com/DmitryBaranovskiy/raphael/issues/491)
	// This workaround only partially corrects the issue:
	// Chrome getBBox implementation is bugged
	if (text.getBBox().width == 0)
	{
		var tspan = text.node.getElementsByTagName('tspan')[0];
		if (tspan)
		{
			tspan.setAttribute('dy', 0);
		}
	}
}

function TextRect(x_elt, elt, x1, y1, x2, y2)
{
	var txt = GetTextI(elt.idx);
	TextLine(x_elt, elt, (x1 + x2) / 2.0, (y1 + y2) / 2.0, x2 - x1, y2 - y1, 0, txt);
}

function ArcPath(r, a1, a2, sweep)
{
	var p = '';
	var n = Math.floor(Math.abs(a2 - a1) * 2 / Math.PI) + 1;
	var i;
	for (i=1; i<=n; i++)
	{
		p += ' A ' + (coordX * r) + ',' + (coordY * r) +
			' 0 0,' + sweep + ' ' +
			(coordX * r * Math.sin(a1+(a2-a1)*i/n)) + ',' + (-coordY * r * Math.cos(a1+(a2-a1)*i/n));
	}
	return(p);
}

function Sector(x_elt, elt, a1, a2, r1, r2)
{
	// Build sector path
	var delta = a1 % (2 * Math.PI) - a1;
	a1 += delta;
	a2 += delta;
	var ap1 = (coordX * r1 * Math.sin(a1)) + ',' + (-coordY * r1 * Math.cos(a1));
	var ap2 = (coordX * r1 * Math.sin(a2)) + ',' + (-coordY * r1 * Math.cos(a2));
	var ap3 = (coordX * r2 * Math.sin(a1)) + ',' + (-coordY * r2 * Math.cos(a1));
	var ap4 = (coordX * r2 * Math.sin(a2)) + ',' + (-coordY * r2 * Math.cos(a2));
	var ap = 'M ' + ap2 + ArcPath(r1, a2, a1, 0) + ' L ' + ap3 + ArcPath(r2, a1, a2, 1) + ' z';
	// Compute text position
	var r = (r1 + r2) / 2;
	var a = (a1 + a2) / 2;
	var h = coordX * (r2 - r1);
	var w = coordX * r * Math.min(Math.abs(Math.sin(Math.acos(r1 / r2))), Math.abs(a2 - a1));
	// 
	if (elt.shape === null)
	{
		// Create sector
		elt.shape = svgPaper.path(ap);
		// Create text over the sector
		var txt = GetTextI(elt.idx);
		TextLine(x_elt, elt, coordX * r * Math.sin(a), -coordY * r * Math.cos(a), w, h, a, txt);
		// Build the SVG elements style
		SvgSetStyle(x_elt, elt);
	}
	else
	{
		if (elt.shown)
		{
			// Modify sector
			elt.shape.attr('path', ap);
			elt.shape.show();
			// Modify text
			TextLine(x_elt, elt, coordX * r * Math.sin(a), -coordY * r * Math.cos(a), w, h, a, txt);
		}
	}
	// Build animation sector path
	var ar1 = r1 + (r1 - r2) * (animationZoom - 1);
	var ar2 = r2 + (r2 - r1) * (animationZoom - 1);
	var azoom = sign(a1 - a2) * Math.min(Math.abs(a1 - a2) * (animationZoom - 1), Math.PI / 36)
	var aa1 = a1 + azoom;
	var aa2 = a2 - azoom;
	var aap1 = (coordX * ar1 * Math.sin(aa1)) + ',' + (-coordY * ar1 * Math.cos(aa1));
	var aap2 = (coordX * ar1 * Math.sin(aa2)) + ',' + (-coordY * ar1 * Math.cos(aa2));
	var aap3 = (coordX * ar2 * Math.sin(aa1)) + ',' + (-coordY * ar2 * Math.cos(aa1));
	var aap4 = (coordX * ar2 * Math.sin(aa2)) + ',' + (-coordY * ar2 * Math.cos(aa2));
	var aap = 'M ' + aap2 + ArcPath(ar1, aa2, aa1, 0) + ' L ' + aap3 + ArcPath(ar2, aa1, aa2, 1) + ' z';
	elt.shapeAnimation = {path: aap};
	elt.shapeAnimationReset = {path: ap};
}

function Rectangle(x_elt, elt, x, y, w, h)
{
	if (elt.shape === null)
	{
		// Create rectangle
		elt.shape = svgPaper.rect(x, y, w, h);
		// Create text over the rectangle
		var txt = GetTextI(elt.idx);
		var tw = w;
		var th = h;
		TextLine(x_elt, elt, x + w / 2.0, y + h / 2.0, w, h, 0, txt);
		// Build the SVG elements style
		SvgSetStyle(x_elt, elt);
	}
	else
	{
		if (elt.shown)
		{
			// Modify rectangle
			elt.shape.attr('x', x);
			elt.shape.attr('y', y);
			elt.shape.attr('width', w);
			elt.shape.attr('height', h);
			elt.shape.show();
			// Modify text
			TextLine(x_elt, elt, x + w / 2.0, y + h / 2.0, w, h, 0);
		}
	}
	elt.shapeAnimation = {transform: 's' + animationZoom + ' ' + animationZoom};
	elt.shapeAnimationReset = {transform: ''};
}

function GetTextI(idx)
{
	if (idx < 0) return('?');
	return(I(idx, 'short_name'));
}

})(this);
