// Gramps - a GTK+/GNOME based genealogy program
//
// Copyright (C) 2014 Pierre Bélissent
//
// This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.
// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
// You should have received a copy of the GNU General Public License along with this program; if not, write to the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA

// This script is part of the Gramps dynamic web report
// See 'dynamicweb.py'
//
// This script performs the following treatments:
//
//	- Build the document body structure:
//	  The body contains the following sections (div):!
//		 header: the header note given as parameter in Gramps
//		 menu: The page menu
//			This menu contains a form for: search input, number of generations inputs
//			This menu is optional (depends on the body class "dwr-menuless")
//		 body-page: The contents of the page
//			the body-page could contain a search form
//		 footer: the footer note given as parameter in Gramps
//
//	- Manage the URL search string:
//	  The URL search string is used to pass parameters to the page
//
//	- Manage the menu form, and the search form embedded form

(function(window, undefined) {
"use strict";


//=================================================================
//============================================================ Body
//=================================================================

// Wait for the document to be ready
$(document).ready(function(){
	BodyDecorate();
});

function BodyDecorate()
{
	// Build the page structure: menu, header, footer

	// Parse the URL search string
	Dwr.ParseSearchString();

	// Check if the current page needs a menu
	var menuless = false;
	if ($('.dwr-menuless').length > 0) menuless = true;
	if (Dwr.search.SvgExpanded) menuless = true;
	if (Dwr.search.MapExpanded) menuless = true;

	// Build the div for the body content
	$('body').wrapInner('<div id="body-page" class="container"></div>');

	// Build menu if any
	if (!menuless)
	{
		BuildMenu();
	}

	// Text for the header
	if (DwrConf.headernote != '') $('body').prepend(
		'<div id="dwr-header">' +
		DwrConf.headernote +
		'</div>');

	// Text for the footer
	var ct = '';
	if (Dwr.search.IncChangeTime) ct = '<p id="dwr-change-time" class="dwr-change-time">';
	var foot = DwrConf.footernote + DwrConf.COPYRIGHT + ct;
	if (foot != '') $('body').append(
		'<div id="dwr-footer" class="panel-footer">' + foot + '</div>'
	);

	// Create embedded search forms
	var esf = $('.embed-search');
	for (var i = 0; i < esf.length; i += 1) $(esf).html(embedSearchText());

	// Set search form defaut value
	for (var i = 0; i < nbSearchForms; i += 1)
	{
		// $('#dwr-search-' + nbSearchForms + '-txt').val(Dwr.search.Txt); does not work completely, and is counter-intuitive.
	}

	// Bootstrap responsive design detection
	// $('body').append(
		// '<div class="device-xs visible-xs-block"></div>' +
		// '<div class="device-sm visible-sm-block"></div>' +
		// '<div class="device-md visible-md-block"></div>' +
		// '<div class="device-lg visible-lg-block"></div>'
	// );
}


// function isBreakpoint(alias)
// {
	// Bootstrap responsive design detection
	// return $('.device-' + alias).is(':visible');
// }


DwrClass.prototype.BodyContentsMaxSize = function()
{
	// Return the available size for the body contents (in 'body_page_inner' div),
	// without any scrollbar needed to show all the contents.
	// The size is return as an object with 'width' and 'height' attributes
	var w = $(window).width();
	var h = $(window).height();
	if ($('#dwr-header').is(':visible')) h -= $('#dwr-header').outerHeight(true);
	if ($('#dwr-footer').is(':visible')) h -= $('#dwr-footer').outerHeight(true);
	if ($('#dwr-menu').is(':visible')) h -= $('#dwr-menu').outerHeight(true);
	var size = {'width': w, 'height': h}
	size = Dwr.InnerDivNetSize(size, $('body'));
	size = Dwr.InnerDivNetSize(size, $('#body-page'));
	return(size);
}


DwrClass.prototype.InnerDivNetSize = function(size, div)
{
	// Return the available size for the contents of "div",
	// based on a given size "size" for the div "div".
	var w = size.width;
	var h = size.height;
	if (div && div.length > 0)
	{
		var m = div.margin();
		var p = div.padding();
		var b = div.border();
		w -= p.left + b.left + m.left + p.right + b.right + m.right;
		h -= p.top + b.top + m.top + p.bottom + b.bottom + m.bottom;
	}
	return({'width': w, 'height': h});
}


//=================================================================
//=================================================== Search string
//=================================================================

// The parameters used for all the pages are given below
// The Dwr.ParseSearchString function updates the variables below from the URL search string
// The Dwr.BuildSearchString function builds the URL search string from the variables below

DwrClass.prototype.search = {
	//P; // Previous page
	//=========================================== Data
	//Txt; // Test of the search input form (in the navbar or embedded in the page)
	//Idx; // Index of the current person (in table "I")
	//Fdx; // Index of the current family (in table "F")
	//Mdx; // Index of the current media object (in table "M")
	//Sdx; // Index of the current source (in table "S")
	//Pdx; // Index of the current place (in table "P")
	//Rdx; // Index of the current repository (in table "R")
	//Edx; // Index of the current repository (in table "E")
	//Tdx; // Index of the current note (in table "T")
	//Ndx; // Index of the current surname (in table "N")
	//Igid; // Gramps ID of the current person
	//Fgid; // Gramps ID of the current family
	//Mgid; // Gramps ID of the current media object
	//Sgid; // Gramps ID of the current source
	//Pgid; // Gramps ID of the current place
	//Rgid; // Gramps ID of the current repository
	//Egid; // Gramps ID of the current event
	//Tgid; // Gramps ID of the current note
	//ImgList; // List of media index (in table "M") for the slideshow
	//MapExpanded; // Whether the map should be expanded to full screen
	//=========================================== SVG tree
	//SvgType; // Type of SVG graph used
	//SvgShape; // The SVG graph shape
	//Asc; // Number of ascending generations
	//Dsc; // Number of descending generations
	//SvgDistribAsc; // The SVG graph parents distribution
	//SvgDistribDsc; // The SVG graph children distribution
	//SvgBackground; // The SVG graph color scheme
	//SvgDup; // Show duplicates in SVG graph
	//SvgExpanded; // Whether the SVG tree should be expanded to full screen
	//=========================================== Configuration parameters
	//IndexShowDates;
	//IndexShowPartner;
	//IndexShowParents;
	//IndexShowBkrefType;
	//ShowAllSiblings;
	//IncEvents;
	//IncFamilies;
	//IncSources;
	//IncMedia;
	//IncPlaces;
	//IncRepositories;
	//IncNotes;
	//IncAddresses;
	//MapPlace;
	//MapFamily;
	//SourceAuthorInTitle;
	//TabbedPanels;
	//IncChangeTime;
	//HideGid;
	//IndexTypeN;
	//IndexTypeI;
	//IndexTypeF;
	//IndexTypeS;
	//IndexTypeP;
	//IndexTypeE;
	//=========================================== Chart
	//ChartTable; // Data table for the statistics chart
	//ChartType; // Type of statistics chart
	//ChartDataW; // Data extractor, Series
	//ChartDataX; // Data extractor, X axis
	//ChartDataY; // Data extractor, Y axis
	//ChartDataZ; // Data extractor, Z axis
	//ChartFunctionX; // Data function, X axis
	//ChartFunctionY; // Data function, Y axis
	//ChartFunctionZ; // Data function, Z axis
	//ChartFilter1; // Data filter 1
	//ChartFilter2; // Data filter 2
	//ChartFilter3; // Data filter 3
	//ChartFilter1Min; // Data filter range lower bound
	//ChartFilter2Min; // Data filter range lower bound
	//ChartFilter3Min; // Data filter range lower bound
	//ChartFilter1Max; // Data filter range upper bound
	//ChartFilter2Max; // Data filter range upper bound
	//ChartFilter3Max; // Data filter range upper bound
	//ChartOpacity; // Chart point opacity
	//ChartBackground; // Chart point color theme
	//ChartValW; // Data value clicked, Series
	//ChartValX; // Data value clicked, X axis
	//ChartValY; // Data value clicked, Y axis
	//ChartValZ; // Data value clicked, Z axis
};


// Does the page contain an embedded search input ?
var searchEmbedded = false;

// Was the URL search string parsed ?
var searchInitialized = false;

DwrClass.prototype.defaultSearchString = {
	P: '',

	Txt: '',
	Idx: -1,
	Fdx: -1,
	Mdx: -1,
	Sdx: -1,
	Pdx: -1,
	Rdx: -1,
	Edx: -1,
	Tdx: -1,
	Ndx: -1,
	Igid: '',
	Fgid: '',
	Mgid: '',
	Sgid: '',
	Pgid: '',
	Rgid: '',
	Egid: '',
	Tgid: '',
	ImgList: [],
	MapExpanded: false,

	Asc: 4,
	Dsc: 4,
	SvgType: DwrConf.svg_tree_type,
	SvgShape: DwrConf.svg_tree_shape,
	SvgDistribAsc: DwrConf.svg_tree_distrib_asc,
	SvgDistribDsc: DwrConf.svg_tree_distrib_dsc,
	SvgBackground: DwrConf.svg_tree_background,
	SvgDup: DwrConf.svg_tree_show_dup,
	SvgExpanded: false,

	IndexShowDates: DwrConf.index_show_dates,
	IndexShowPartner: DwrConf.index_show_partner,
	IndexShowParents: DwrConf.index_show_parents,
	IndexShowPath: DwrConf.index_show_path,
	IndexShowBkrefType: DwrConf.index_show_bkref,
	ShowAllSiblings: DwrConf.show_all_siblings,
	IncEvents: DwrConf.inc_events_pages,
	IncFamilies: DwrConf.inc_families_pages,
	IncSources: DwrConf.inc_sources,
	IncMedia: DwrConf.inc_gallery,
	IncPlaces: DwrConf.inc_places_pages,
	IncRepositories: DwrConf.inc_repositories,
	IncNotes: DwrConf.inc_notes,
	IncAddresses: DwrConf.inc_addresses,
	MapPlace: DwrConf.placemappages,
	MapFamily: DwrConf.familymappages,
	SourceAuthorInTitle: DwrConf.source_author,
	TabbedPanels: DwrConf.tabbed_panels,
	IncChangeTime: DwrConf.inc_change_time,
	HideGid: DwrConf.hide_gid,
	IndexTypeN: DwrConf.index_surnames_type,
	IndexTypeI: DwrConf.index_persons_type,
	IndexTypeF: DwrConf.index_families_type,
	IndexTypeS: DwrConf.index_sources_type,
	IndexTypeP: DwrConf.index_places_type,
	IndexTypeE: DwrConf.index_events_type,
	IndexTypeT: DwrConf.index_notes_type,

	ChartTable: 0,
	ChartType: 0,
	ChartDataW: -1,
	ChartDataX: -1,
	ChartDataY: -1,
	ChartDataZ: -1,
	ChartFunctionX: 0,
	ChartFunctionY: 0,
	ChartFunctionZ: 0,
	ChartFilter1: -1,
	ChartFilter2: -1,
	ChartFilter3: -1,
	ChartFilter1Min: "",
	ChartFilter2Min: "",
	ChartFilter3Min: "",
	ChartFilter1Max: "",
	ChartFilter2Max: "",
	ChartFilter3Max: "",
	ChartOpacity: DwrConf.STATISTICS_CHART_OPACITY,
	ChartBackground: DwrConf.CHART_BACKGROUND_GRADIENT,
	ChartValW: "",
	ChartValX: "",
	ChartValY: "",
	ChartValZ: ""
};

DwrClass.prototype.ParseSearchString = function()
{
	// Parse the URL search string
	if (searchInitialized) return;
	searchInitialized = true;
	Dwr.search.P = GetURLParameter('p', '');

	Dwr.search.Txt = GetURLParameter('stxt', '');
	Dwr.search.Idx = GetURLParameter('idx', -1);
	Dwr.search.Fdx = GetURLParameter('fdx', -1);
	Dwr.search.Mdx = GetURLParameter('mdx', -1);
	Dwr.search.Sdx = GetURLParameter('sdx', -1);
	Dwr.search.Pdx = GetURLParameter('pdx', -1);
	Dwr.search.Rdx = GetURLParameter('rdx', -1);
	Dwr.search.Edx = GetURLParameter('edx', -1);
	Dwr.search.Tdx = GetURLParameter('tdx', -1);
	Dwr.search.Ndx = GetURLParameter('ndx', -1);
	Dwr.search.Igid = GetURLParameter('igid', '');
	Dwr.search.Fgid = GetURLParameter('fgid', '');
	Dwr.search.Mgid = GetURLParameter('mgid', '');
	Dwr.search.Sgid = GetURLParameter('sgid', '');
	Dwr.search.Pgid = GetURLParameter('pgid', '');
	Dwr.search.Rgid = GetURLParameter('rgid', '');
	Dwr.search.Egid = GetURLParameter('egid', '');
	Dwr.search.Tgid = GetURLParameter('tgid', '');
	Dwr.search.ImgList = GetURLParameter('simg', []);
	if (Dwr.search.Mdx != -1 && Dwr.search.ImgList.length == 0) Dwr.search.ImgList = [Dwr.search.Mdx];
	Dwr.search.MapExpanded = GetURLParameter('mexp', false);

	Dwr.search.Asc = GetURLParameter('sasc', 4);
	Dwr.search.Dsc = GetURLParameter('sdsc', 4);
	Dwr.search.SvgType = GetURLParameter('svgtype', DwrConf.svg_tree_type);
	Dwr.search.SvgShape = GetURLParameter('svgshape', DwrConf.svg_tree_shape);
	Dwr.search.SvgDistribAsc = GetURLParameter('svgdasc', DwrConf.svg_tree_distrib_asc);
	Dwr.search.SvgDistribDsc = GetURLParameter('svgddsc', DwrConf.svg_tree_distrib_dsc);
	Dwr.search.SvgBackground = GetURLParameter('svgbk', DwrConf.svg_tree_background);
	Dwr.search.SvgDup = GetURLParameter('svgdup', DwrConf.svg_tree_show_dup);
	Dwr.search.SvgExpanded = GetURLParameter('svgx', false);

	Dwr.search.IndexShowDates = GetURLParameter('cid', DwrConf.index_show_dates);
	Dwr.search.IndexShowPartner = GetURLParameter('cis', DwrConf.index_show_partner);
	Dwr.search.IndexShowParents = GetURLParameter('cip', DwrConf.index_show_parents);
	Dwr.search.IndexShowPath = GetURLParameter('cia', DwrConf.index_show_path);
	Dwr.search.IndexShowBkrefType = GetURLParameter('cib', DwrConf.index_show_bkref);
	Dwr.search.ShowAllSiblings = GetURLParameter('csib', DwrConf.show_all_siblings);
	Dwr.search.IncEvents = GetURLParameter('ce', DwrConf.inc_events_pages);
	Dwr.search.IncFamilies = GetURLParameter('cf', DwrConf.inc_families_pages);
	Dwr.search.IncSources = GetURLParameter('cs', DwrConf.inc_sources);
	Dwr.search.IncMedia = GetURLParameter('cm', DwrConf.inc_gallery);
	Dwr.search.IncPlaces = GetURLParameter('cp', DwrConf.inc_places_pages);
	Dwr.search.IncRepositories = GetURLParameter('cr', DwrConf.inc_repositories);
	Dwr.search.IncNotes = GetURLParameter('cn', DwrConf.inc_notes);
	Dwr.search.IncAddresses = GetURLParameter('ca', DwrConf.inc_addresses);
	Dwr.search.MapPlace = GetURLParameter('cmp', DwrConf.placemappages);
	Dwr.search.MapFamily = GetURLParameter('cmf', DwrConf.familymappages);
	Dwr.search.SourceAuthorInTitle = GetURLParameter('csa', DwrConf.source_author);
	Dwr.search.TabbedPanels = GetURLParameter('ctp', DwrConf.tabbed_panels);
	Dwr.search.IncChangeTime = GetURLParameter('cct', DwrConf.inc_change_time);
	Dwr.search.HideGid = GetURLParameter('cg', DwrConf.hide_gid);
	Dwr.search.IndexTypeN = GetURLParameter('citn', DwrConf.index_surnames_type);
	Dwr.search.IndexTypeI = GetURLParameter('citi', DwrConf.index_persons_type);
	Dwr.search.IndexTypeF = GetURLParameter('citf', DwrConf.index_families_type);
	Dwr.search.IndexTypeS = GetURLParameter('cits', DwrConf.index_sources_type);
	Dwr.search.IndexTypeP = GetURLParameter('citp', DwrConf.index_places_type);
	Dwr.search.IndexTypeE = GetURLParameter('cite', DwrConf.index_events_type);
	Dwr.search.IndexTypeT = GetURLParameter('citt', DwrConf.index_notes_type);

	Dwr.search.ChartTable = GetURLParameter('charttable', 0);
	Dwr.search.ChartType = GetURLParameter('charttype', 0);
	Dwr.search.ChartDataW = GetURLParameter('chartw', -1);
	Dwr.search.ChartDataX = GetURLParameter('chartx', -1);
	Dwr.search.ChartDataY = GetURLParameter('charty', -1);
	Dwr.search.ChartDataZ = GetURLParameter('chartz', -1);
	Dwr.search.ChartFunctionX = GetURLParameter('chartfx', 0);
	Dwr.search.ChartFunctionY = GetURLParameter('chartfy', 0);
	Dwr.search.ChartFunctionZ = GetURLParameter('chartfz', 0);
	Dwr.search.ChartFilter1 = GetURLParameter('chartfr1', -1);
	Dwr.search.ChartFilter2 = GetURLParameter('chartfr2', -1);
	Dwr.search.ChartFilter3 = GetURLParameter('chartfr3', -1);
	Dwr.search.ChartFilter1Min = GetURLParameter('chartfr1i', "");
	Dwr.search.ChartFilter2Min = GetURLParameter('chartfr2i', "");
	Dwr.search.ChartFilter3Min = GetURLParameter('chartfr3i', "");
	Dwr.search.ChartFilter1Max = GetURLParameter('chartfr1a', "");
	Dwr.search.ChartFilter2Max = GetURLParameter('chartfr2a', "");
	Dwr.search.ChartFilter3Max = GetURLParameter('chartfr3a', "");
	Dwr.search.ChartOpacity = GetURLParameter('chartopa', DwrConf.STATISTICS_CHART_OPACITY);
	Dwr.search.ChartBackground = GetURLParameter('chartbk', DwrConf.CHART_BACKGROUND_GRADIENT);
	Dwr.search.ChartValW = GetURLParameter('chartvw', "");
	Dwr.search.ChartValX = GetURLParameter('chartvx', "");
	Dwr.search.ChartValY = GetURLParameter('chartvy', "");
	Dwr.search.ChartValZ = GetURLParameter('chartvz', "");
}

function GetURLParameter(sParam, def)
{
	// Get a value from the URL search string
	// sParam: name of the parameter
	// def: Parameter default value
	var sPageURL = window.location.search.substring(1);
	var sURLVariables = sPageURL.split('&');
	for (var i = 0; i < sURLVariables.length; i++)
	{
		var sParameterName = sURLVariables[i].split('=');
		if (sParameterName[0] == sParam)
		{
			var s = decodeURIComponent(sParameterName[1]);
			if (typeof(def) == 'number')
			{
				s = parseInt(s);
				if (isNaN(s)) s = def;
			}
			if (def instanceof Array) s = $.parseJSON(s);
			if (typeof(def) == 'boolean')
			{
				if ($.inArray(s, ['true', 'on']) >= 0) s = true;
				if ($.inArray(s, ['false', 'off']) >= 0) s = false;
				if (!isNaN(parseInt(s))) s = parseInt(s);
				s = s ? true : false;
			}
			return(s);
		}
	}
	return(def);
}


DwrClass.prototype.BuildSearchString = function(params)
{
	// Builds the URL search string from the global parameters values ("search")
	// and from the optional parameter of the function "params"
	// "params" has the same structure as "search"
	params = (typeof(params) !== 'undefined') ? params : {};
	var s = '';
	var page = window.location.href.replace(/\?.*/, '').replace(Dwr.toRoot, '£££').replace(/.*£££/, '');
	if (page == 'conf.html') page = Dwr.search.P;
	s = SetURLParameter(s, 'p', params.P, page, '');

	s = SetURLParameter(s, 'stxt', params.Txt, Dwr.search.Txt, '');
	s = SetURLParameter(s, 'idx', params.Idx, Dwr.search.Idx, -1);
	s = SetURLParameter(s, 'fdx', params.Fdx, Dwr.search.Fdx, -1);
	s = SetURLParameter(s, 'mdx', params.Mdx, Dwr.search.Mdx, -1);
	s = SetURLParameter(s, 'sdx', params.Sdx, Dwr.search.Sdx, -1);
	s = SetURLParameter(s, 'pdx', params.Pdx, Dwr.search.Pdx, -1);
	s = SetURLParameter(s, 'rdx', params.Rdx, Dwr.search.Rdx, -1);
	s = SetURLParameter(s, 'edx', params.Edx, Dwr.search.Edx, -1);
	s = SetURLParameter(s, 'tdx', params.Tdx, Dwr.search.Tdx, -1);
	s = SetURLParameter(s, 'ndx', params.Ndx, Dwr.search.Ndx, -1);
	s = SetURLParameter(s, 'igid', params.Igid, Dwr.search.Igid, '');
	s = SetURLParameter(s, 'fgid', params.Fgid, Dwr.search.Fgid, '');
	s = SetURLParameter(s, 'mgid', params.Mgid, Dwr.search.Mgid, '');
	s = SetURLParameter(s, 'sgid', params.Sgid, Dwr.search.Sgid, '');
	s = SetURLParameter(s, 'pgid', params.Pgid, Dwr.search.Pgid, '');
	s = SetURLParameter(s, 'rgid', params.Rgid, Dwr.search.Rgid, '');
	s = SetURLParameter(s, 'egid', params.Egid, Dwr.search.Egid, '');
	s = SetURLParameter(s, 'tgid', params.Tgid, Dwr.search.Tgid, '');
	s = SetURLParameter(s, 'simg', params.ImgList, Dwr.search.ImgList, []);
	s = SetURLParameter(s, 'mexp', params.MapExpanded, Dwr.search.MapExpanded, false);

	s = SetURLParameter(s, 'sasc', params.Asc, Dwr.search.Asc, 4);
	s = SetURLParameter(s, 'sdsc', params.Dsc, Dwr.search.Dsc, 4);
	s = SetURLParameter(s, 'svgtype', params.SvgType, Dwr.search.SvgType, DwrConf.svg_tree_type);
	s = SetURLParameter(s, 'svgshape', params.SvgShape, Dwr.search.SvgShape, DwrConf.svg_tree_shape);
	s = SetURLParameter(s, 'svgdasc', params.SvgDistribAsc, Dwr.search.SvgDistribAsc, DwrConf.svg_tree_distrib_asc);
	s = SetURLParameter(s, 'svgddsc', params.SvgDistribDsc, Dwr.search.SvgDistribDsc, DwrConf.svg_tree_distrib_dsc);
	s = SetURLParameter(s, 'svgbk', params.SvgBackground, Dwr.search.SvgBackground, DwrConf.svg_tree_background);
	s = SetURLParameter(s, 'svgdup', params.SvgDup, Dwr.search.SvgDup, DwrConf.svg_tree_show_dup);
	s = SetURLParameter(s, 'svgx', params.SvgExpanded, Dwr.search.SvgExpanded, false);

	s = SetURLParameter(s, 'cid', params.IndexShowDates, Dwr.search.IndexShowDates, DwrConf.index_show_dates);
	s = SetURLParameter(s, 'cis', params.IndexShowPartner, Dwr.search.IndexShowPartner, DwrConf.index_show_partner);
	s = SetURLParameter(s, 'cip', params.IndexShowParents, Dwr.search.IndexShowParents, DwrConf.index_show_parents);
	s = SetURLParameter(s, 'cia', params.IndexShowPath, Dwr.search.IndexShowPath, DwrConf.index_show_path);
	s = SetURLParameter(s, 'cib', params.IndexShowBkrefType, Dwr.search.IndexShowBkrefType, DwrConf.index_show_bkref);
	s = SetURLParameter(s, 'csib', params.ShowAllSiblings, Dwr.search.ShowAllSiblings, DwrConf.show_all_siblings);
	s = SetURLParameter(s, 'ce', params.IncEvents, Dwr.search.IncEvents, DwrConf.inc_events_pages);
	s = SetURLParameter(s, 'cf', params.IncFamilies, Dwr.search.IncFamilies, DwrConf.inc_families_pages);
	s = SetURLParameter(s, 'cs', params.IncSources, Dwr.search.IncSources, DwrConf.inc_sources);
	s = SetURLParameter(s, 'cm', params.IncMedia, Dwr.search.IncMedia, DwrConf.inc_gallery);
	s = SetURLParameter(s, 'cp', params.IncPlaces, Dwr.search.IncPlaces, DwrConf.inc_places_pages);
	s = SetURLParameter(s, 'cr', params.IncRepositories, Dwr.search.IncRepositories, DwrConf.inc_repositories);
	s = SetURLParameter(s, 'cn', params.IncNotes, Dwr.search.IncNotes, DwrConf.inc_notes);
	s = SetURLParameter(s, 'ca', params.IncAddresses, Dwr.search.IncAddresses, DwrConf.inc_addresses);
	s = SetURLParameter(s, 'cmp', params.MapPlace, Dwr.search.MapPlace, DwrConf.placemappages);
	s = SetURLParameter(s, 'cmf', params.MapFamily, Dwr.search.MapFamily, DwrConf.familymappages);
	s = SetURLParameter(s, 'csa', params.SourceAuthorInTitle, Dwr.search.SourceAuthorInTitle, DwrConf.source_author);
	s = SetURLParameter(s, 'ctp', params.TabbedPanels, Dwr.search.TabbedPanels, DwrConf.tabbed_panels);
	s = SetURLParameter(s, 'cct', params.IncChangeTime, Dwr.search.IncChangeTime, DwrConf.inc_change_time);
	s = SetURLParameter(s, 'cg', params.HideGid, Dwr.search.HideGid, DwrConf.hide_gid);
	s = SetURLParameter(s, 'citn', Dwr.search.IndexTypeN, Dwr.search.IndexTypeN, DwrConf.index_surnames_type);
	s = SetURLParameter(s, 'citi', Dwr.search.IndexTypeI, Dwr.search.IndexTypeI, DwrConf.index_persons_type);
	s = SetURLParameter(s, 'citf', Dwr.search.IndexTypeF, Dwr.search.IndexTypeF, DwrConf.index_families_type);
	s = SetURLParameter(s, 'cits', Dwr.search.IndexTypeS, Dwr.search.IndexTypeS, DwrConf.index_sources_type);
	s = SetURLParameter(s, 'citp', Dwr.search.IndexTypeP, Dwr.search.IndexTypeP, DwrConf.index_places_type);
	s = SetURLParameter(s, 'cite', Dwr.search.IndexTypeE, Dwr.search.IndexTypeE, DwrConf.index_events_type);
	s = SetURLParameter(s, 'citt', Dwr.search.IndexTypeT, Dwr.search.IndexTypeT, DwrConf.index_notes_type);

	s = SetURLParameter(s, 'charttable', params.ChartTable, Dwr.search.ChartTable, 0);
	s = SetURLParameter(s, 'charttype', params.ChartType, Dwr.search.ChartType, 0);
	s = SetURLParameter(s, 'chartw', params.ChartDataW, Dwr.search.ChartDataW, -1);
	s = SetURLParameter(s, 'chartx', params.ChartDataX, Dwr.search.ChartDataX, -1);
	s = SetURLParameter(s, 'charty', params.ChartDataY, Dwr.search.ChartDataY, -1);
	s = SetURLParameter(s, 'chartz', params.ChartDataZ, Dwr.search.ChartDataZ, -1);
	s = SetURLParameter(s, 'chartfx', params.ChartFunctionX, Dwr.search.ChartFunctionX, 0);
	s = SetURLParameter(s, 'chartfy', params.ChartFunctionY, Dwr.search.ChartFunctionY, 0);
	s = SetURLParameter(s, 'chartfz', params.ChartFunctionZ, Dwr.search.ChartFunctionZ, 0);
	s = SetURLParameter(s, 'chartfr1', params.ChartFilter1, Dwr.search.ChartFilter1, -1);
	s = SetURLParameter(s, 'chartfr2', params.ChartFilter2, Dwr.search.ChartFilter2, -1);
	s = SetURLParameter(s, 'chartfr3', params.ChartFilter3, Dwr.search.ChartFilter3, -1);
	s = SetURLParameter(s, 'chartfr1i', params.ChartFilter1Min, Dwr.search.ChartFilter1Min, "");
	s = SetURLParameter(s, 'chartfr2i', params.ChartFilter2Min, Dwr.search.ChartFilter2Min, "");
	s = SetURLParameter(s, 'chartfr3i', params.ChartFilter3Min, Dwr.search.ChartFilter3Min, "");
	s = SetURLParameter(s, 'chartfr1a', params.ChartFilter1Max, Dwr.search.ChartFilter1Max, "");
	s = SetURLParameter(s, 'chartfr2a', params.ChartFilter2Max, Dwr.search.ChartFilter2Max, "");
	s = SetURLParameter(s, 'chartfr3a', params.ChartFilter3Max, Dwr.search.ChartFilter3Max, "");
	s = SetURLParameter(s, 'chartopa', params.ChartOpacity, Dwr.search.ChartOpacity, DwrConf.STATISTICS_CHART_OPACITY);
	s = SetURLParameter(s, 'chartbk', params.ChartBackground, Dwr.search.ChartBackground, DwrConf.CHART_BACKGROUND_GRADIENT);
	s = SetURLParameter(s, 'chartvw', params.ChartDataW, Dwr.search.ChartValW, "");
	s = SetURLParameter(s, 'chartvx', params.ChartDataX, Dwr.search.ChartValX, "");
	s = SetURLParameter(s, 'chartvy', params.ChartDataY, Dwr.search.ChartValY, "");
	s = SetURLParameter(s, 'chartvz', params.ChartDataZ, Dwr.search.ChartValZ, "");
	return(s);
}

function SetURLParameter(sString, sParam, new_val, val, def)
{
	// Update the URL search string "sString" with the parameter "sParam"
	// new_val is the new parameter value, if any
	// val is the current parameter value, if any
	// val is the default parameter value, of type: number, boolean, Array, string

	// Manage when values are not provided
	val = (val == null || typeof(val) === 'undefined') ? def : val;
	val = (new_val == null || typeof(new_val) === 'undefined' || new_val == def) ? val : new_val;
	// Manage each type of value
	if (typeof(def) == 'number')
	{
		val = parseInt(val);
	}
	// else if (typeof(def) == 'string')
	// {
		// val = (val == '') ? def : val;
		// val = (new_val == '') ? val : new_val;
	// }
	else if (def instanceof Array)
	{
		val = (val == null || typeof(val) === 'undefined' || val.length == 0) ? def : val;
		val = (new_val == null || typeof(new_val) === 'undefined' || new_val.length == 0) ? val : new_val;
		val = JSON.stringify(val);
		def = JSON.stringify(def);
	}
	else if (typeof(def) == 'boolean')
	{
		val = val ? 1: 0;
		def = def ? 1: 0;
	}
	// Don't modify the search string if the value = default value
	if (val == def) return(sString);
	if (sString != '') sString += '&';
	return(sString + sParam + '=' + encodeURIComponent(val.toString()));
}


function Redirect(url)
{
	// Redirects to a given url

	var change_page = false;
	// Get the current page URL
	this_url = window.location.href;
	// this removes the anchor at the end, if there is one
	this_url = this_url.substring(0, (this_url.indexOf('#') == -1) ? this_url.length : this_url.indexOf('#'));
	// this removes the query after the file name, if there is one
	this_url = this_url.substring(0, (this_url.indexOf('?') == -1) ? this_url.length : this_url.indexOf('?'));
	if (typeof(url) === 'undefined') url = this_url;
	window.location.href = url + '?' + Dwr.BuildSearchString();
}


//=================================================================
//=================================================== Form and menu
//=================================================================

function FsearchExec(n)
{
	// Search input submission
	// n: 0 = search input in the navbar, 1 = search input embedded in page
	Dwr.search.Txt = $('#dwr-search-' + n + '-txt').val();
	Dwr.search.Idx = -1;
	Dwr.search.Fdx = -1;
	Dwr.search.Mdx = -1;
	Dwr.search.Sdx = -1;
	Dwr.search.Pdx = -1;
	Dwr.search.Rdx = -1;
	Dwr.search.Edx = -1;
	// Redirect to the search page
	window.location.href = Dwr.searchHref();
	return(false);
}
DwrClass.prototype.FsearchExec = FsearchExec;


var nbSearchForms = 0;

function BuildMenu()
{
	// Get current page
	var ad = window.location.href;
	ad = ad.replace(/\?.*/, '');
	ad = ad.replace(/.*\//, '');
	var i;

	// Get current menu item
	var i_current = -1;
	for (i=0; i<DwrConf.pages_menu.length; i++)
	{
		if (DwrConf.pages_menu[i][0].indexOf(ad) >= 0)
		{
			// This menu item is the current page
			i_current = i;
		}
	}

	// Text for the form
	var txt_form1 = '';
	txt_form1 += '<div class="pull-right">';
	txt_form1 += '<form class="navbar-form" role="search" onsubmit="return Dwr.FsearchExec(' + nbSearchForms + ')">';
	txt_form1 += '<div class="input-group">';
	txt_form1 += '<input id="dwr-search-' + nbSearchForms + '-txt" type="text" class="form-control dwr-search" placeholder="' + _('Person to search for') + '">';
	txt_form1 += '<div class="input-group-btn">';
	txt_form1 += '<button type="submit" class="btn btn-default"><span class="glyphicon glyphicon-search"></span></button>';
	nbSearchForms += 1;
	txt_form1 += '</div>';
	txt_form1 += '</div>';
	if (DwrConf.inc_pageconf)
	{
		txt_form1 += ' <button type="button" id="dwr-conf" class="btn btn-default dwr-navbar-toggle-enabled" onclick="window.location.href=\'' + (Dwr.toRoot + 'conf.html?' + Dwr.BuildSearchString()) + '\';"><span class="glyphicon glyphicon-cog"></span></button>';
	}
	txt_form1 += '</form>';
	txt_form1 += '</div>';

	// Text for the menu
	var txt_menu = '';
	txt_menu += '<nav id="dwr-menu" class="navbar navbar-default" role="navigation">';
	txt_menu += '<div class="container-fluid">';

	txt_menu += '<div class="navbar-header">';
	txt_menu += '<button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#dwr-navbar-collapse">';
	txt_menu += '<span class="sr-only">Toggle navigation</span>';
	txt_menu += '<span class="icon-bar"></span>';
	txt_menu += '<span class="icon-bar"></span>';
	txt_menu += '<span class="icon-bar"></span>';
	txt_menu += '</button>';
	if (DwrConf.brandnote)
		txt_menu += '<a class="navbar-brand" href="index.html">' + DwrConf.brandnote + '</a>';
	else
		txt_menu += '<a class="navbar-brand" href="https://gramps-project.org/"><img src="data/Gramps_Logo.png"></a>';
	txt_menu += '</div>';

	txt_menu += '<div id="dwr-navbar-collapse" class="collapse navbar-collapse">';
	txt_menu += '<ul class="nav navbar-nav">';
	for (i=0; i<DwrConf.pages_menu.length; i++)
	{
		var addclass = '';
		if (i == i_current) addclass = ' class="active"';
		if (DwrConf.pages_menu[i][0] == "")
		{
			txt_menu += '<li class="dropdown">';
			txt_menu += '<a href="#" class="dropdown-toggle" data-toggle="dropdown">' + _('Indexes') +' <b class="caret"></b></a>';
			txt_menu += '<ul class="dropdown-menu">';
			for (var j = 0; j < DwrConf.pages_menu_index.length; j += 1)
			{
				txt_menu += '<li' + addclass + '><a href="' + Dwr.toRoot + DwrConf.pages_menu_index[j][0] + '?' +  Dwr.BuildSearchString() + '">' + DwrConf.pages_menu_index[j][1] + '</a></li>';
			}
			txt_menu += '</ul></li>';
		}
		else
		{
			txt_menu += '<li' + addclass + '><a href="' + Dwr.toRoot + DwrConf.pages_menu[i][0] + '?' +  Dwr.BuildSearchString() + '">' + DwrConf.pages_menu[i][1] + '</a></li>';
		}
	}
	if (DwrConf.inc_pageconf)
	{
		txt_menu += '<li class="dwr-navbar-toggle-disabled"><a href="' + Dwr.toRoot + 'conf.html' + '?' +  Dwr.BuildSearchString() + '">' + _('Configuration') + '</a></li>';
	}
	txt_menu += '</ul>';
	txt_menu += txt_form1;
	txt_menu += '</div>'; // .navbar-collapse
	txt_menu += '</div>'; // .container-fluid
	txt_menu += '</nav>';

	$('body').prepend(txt_menu);
}


function embedSearchText()
{
	// Build the embedded search input form
	var txt_form = '';
	txt_form += '<form class="form-inline role="search" onsubmit="return Dwr.FsearchExec(' + nbSearchForms + ')">';
	txt_form += '<div class="input-group">';
	txt_form += '<input id="dwr-search-' + nbSearchForms + '-txt" type="text" class="form-control dwr-search" placeholder="' + _('Person to search for') + '">';
	txt_form += '<div class="input-group-btn">';
	txt_form += '<button type="submit" class="btn btn-default"><span class="glyphicon glyphicon-search"></span></button>';
	txt_form += '</div>';
	txt_form += '</div>';
	txt_form += '</form>';
	nbSearchForms += 1;
	searchEmbedded = true;
	return(txt_form);
}
DwrClass.prototype.embedSearchText = embedSearchText;

})(this);
