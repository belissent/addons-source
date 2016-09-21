// Gramps - a GTK+/GNOME based genealogy program
//
// Copyright (C) 2014 Pierre Bélissent
//
// This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.
// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
// You should have received a copy of the GNU General Public License along with this program; if not, write to the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA

(function(window, undefined) {
'use strict';


//=================================================================
//==================================================== Localisation
//=================================================================

function _(text)
{
	if (typeof(DwrConf.__[text]) !== 'undefined') return(DwrConf.__[text]);
	return(text);
}
window._ = _;


//=================================================================
//=================================== Database exported from Gramps
//=================================================================

// Access to databases

function I(x, field) {return GetDb('I', x, field)}
function F(x, field) {return GetDb('F', x, field)}
function S(x, field) {return GetDb('S', x, field)}
function C(x, field) {return GetDb('C', x, field)}
function R(x, field) {return GetDb('R', x, field)}
function M(x, field) {return GetDb('M', x, field)}
function P(x, field) {return GetDb('P', x, field)}
function E(x, field) {return GetDb('E', x, field)}
function T(x, field) {return GetDb('T', x, field)}
function N(x, field) {return GetDb('N', x, field)}

DwrClass.prototype.I = I;
DwrClass.prototype.F = F;
DwrClass.prototype.S = S;
DwrClass.prototype.C = C;
DwrClass.prototype.R = R;
DwrClass.prototype.M = M;
DwrClass.prototype.P = P;
DwrClass.prototype.E = E;
DwrClass.prototype.T = T;
DwrClass.prototype.N = N;

// Exception for abort and wait for script loading
function WaitScriptLoad() {}

var nbScriptsToLoad = 0; // Number of database scripts being currently loaded
var rebuildPageAfterScriptLoad = false; // Request a restart of the page after script load

function GetDb(name, x, field)
{
	var i = Math.floor(x / DwrConf.SPLIT);
	var partial = name + '_' + field + '_' + i;
	if (!window[partial])
	{
		// Script 'db_dwr_*' has to be loaded
		var file = 'dwr_db_' + partial + '.js';
		PreloadScripts([file], true);
	}
	return(window[partial][x % DwrConf.SPLIT]);
}
DwrClass.prototype.GetDb = GetDb;

function NameSplitScripts(name, field)
{
	var scripts = [];
	for (var i = 0; i < DwrConf.db_sizes[name] / DwrConf.SPLIT; i++)
	{
		var partial = name + '_' + field + '_' + i;
		if (!window[partial])
		{
			scripts.push('dwr_db_' + partial + '.js');
		}
	}
	return scripts;
}
DwrClass.prototype.NameSplitScripts = NameSplitScripts;

function NameFieldScripts(name, x, fields)
{
	var scripts = [];
	for (var i = 0; i < fields.length; i++)
	{
		var partial = name + '_' + fields[i] + '_' +  Math.floor(x / DwrConf.SPLIT);;
		if (!window[partial])
		{
			scripts.push('dwr_db_' + partial + '.js');
		}
	}
	return scripts;
}
DwrClass.prototype.NameFieldScripts = NameFieldScripts;

function PreloadScripts(scripts, rebuildPage)
{
	if (scripts.length == 0) return;
	rebuildPage = (typeof(rebuildPage) !== 'undefined') ? rebuildPage : false;
	console.log('Loading ' + scripts);
	// Remove duplicates
	var uniques = [];
	while (scripts.length > 0)
	{
		var s = scripts.pop();
		if ($.inArray(s, uniques) < 0) uniques.push(s);
	}
	// Increment the number of database scripts being loaded
	nbScriptsToLoad += uniques.length;
	// Load scripts in the stream of the document (works with both file:// and http:// protocols)
	for (var j = 0; j < uniques.length; j += 1)
	{
		Dwr.LoadJsFile(uniques[j]);
	}
	// Re-compute the page once the script is downloaded
	if (rebuildPage)
	{
		rebuildPageAfterScriptLoad = true;
		throw new WaitScriptLoad();
	}
}
DwrClass.prototype.PreloadScripts = PreloadScripts;

DwrClass.prototype.ScriptLoaded = function(file)
{
	console.log('Loaded ' + file);
	nbScriptsToLoad -= 1;
	if (nbScriptsToLoad == 0 && rebuildPageAfterScriptLoad)
	{
		rebuildPageAfterScriptLoad = false;
		MainRun();
	}
}

function ScriptIsLoading()
{
	return(nbScriptsToLoad);
}

function buildDataArray(table, field)
{
	// Optimization: Put all the data from the files 'db_dwr_<field>_*.js' into 1 big array, for easier access
	if (window[table + '_' + field]) return;
	var data = new Array(DwrConf.db_sizes[table]);
	for (var i = 0; i <= Math.floor(DwrConf.db_sizes[table] / DwrConf.SPLIT); i += 1)
	{
		var partial = window[table + '_' + field + '_' + i];
		if (!partial) continue;
		for (var x = 0; x < partial.length; x += 1)
		{
			data[DwrConf.SPLIT * i + x] = partial[x];
		}
	}
	window[table + '_' + field] = data;
}

function PrepareFieldSplitScripts(names_fields)
{
	var scripts = [];
	for (var i = 0; i < names_fields.length; i += 1)
	{
		var name = names_fields[i][0];
		var field = names_fields[i][1];
		if (preloadMode)
		{
			// First pass: preload  data
			scripts = scripts.concat(NameSplitScripts(name, field));
		}
		else
		{
			// Second pass: Merge preloaded data into optimized arrays
			buildDataArray(name, field);
		}
	}
	// Preload data
	if (preloadMode) PreloadScripts(scripts, false);
}
DwrClass.prototype.PrepareFieldSplitScripts = PrepareFieldSplitScripts;


//=================================================================
//======================================================= Constants
//=================================================================

// Events fallbacks

var EVENTS_BIRTH = [_('Birth'), _('Baptism'), _('Christening')];
var EVENTS_MARR = [_('Marriage'), _('Engagement'), _('Alternate Marriage')];
var EVENTS_DEATH = [_('Death'), _('Burial'), _('Cremation'), _('Cause Of Death')];


// Type of the page
var i = 1;
DwrClass.prototype.PAGE_HOME = i++;
DwrClass.prototype.PAGE_INDI = i++;
DwrClass.prototype.PAGE_FAM = i++;
DwrClass.prototype.PAGE_SOURCE = i++;
DwrClass.prototype.PAGE_MEDIA = i++;
DwrClass.prototype.PAGE_PLACE = i++;
DwrClass.prototype.PAGE_REPO = i++;
DwrClass.prototype.PAGE_EVENT = i++;
DwrClass.prototype.PAGE_NOTE = i++;
DwrClass.prototype.PAGE_SEARCH = i++;
DwrClass.prototype.PAGE_CONF = i++;
DwrClass.prototype.PAGE_SVG_TREE = i++;
DwrClass.prototype.PAGE_SVG_TREE_FULL = i++;
DwrClass.prototype.PAGE_SVG_TREE_CONF = i++;
DwrClass.prototype.PAGE_SVG_TREE_SAVE = i++;
DwrClass.prototype.PAGE_STATISTICS = i++;
DwrClass.prototype.PAGE_SURNAMES_INDEX = i++;
DwrClass.prototype.PAGE_SURNAME_INDEX = i++;
DwrClass.prototype.PAGE_PERSONS_INDEX = i++;
DwrClass.prototype.PAGE_FAMILIES_INDEX = i++;
DwrClass.prototype.PAGE_SOURCES_INDEX = i++;
DwrClass.prototype.PAGE_MEDIA_INDEX = i++;
DwrClass.prototype.PAGE_PLACES_INDEX = i++;
DwrClass.prototype.PAGE_ADDRESSES_INDEX = i++;
DwrClass.prototype.PAGE_REPOS_INDEX = i++;
DwrClass.prototype.PAGE_EVENTS_INDEX = i++;
DwrClass.prototype.PAGE_NOTES_INDEX = i++;


//=================================================================
//=========================================================== Liens
//=================================================================

var PageFile = {
	'I': 'person.html',
	'F': 'family.html',
	'S': 'source.html',
	'M': 'media.html',
	'P': 'place.html',
	'R': 'repository.html',
	'E': 'event.html',
	'T': 'note.html',
	'N': 'surname.html'
};

var SearchStringField = {
	'I': 'Idx',
	'F': 'Fdx',
	'S': 'Sdx',
	'M': 'Mdx',
	'P': 'Pdx',
	'R': 'Rdx',
	'E': 'Edx',
	'T': 'Tdx',
	'N': 'Ndx'
};

var UrlField = {
	'I': 'idx',
	'F': 'fdx',
	'S': 'sdx',
	'M': 'mdx',
	'P': 'pdx',
	'R': 'rdx',
	'E': 'edx',
	'T': 'tdx',
	'N': 'ndx'
};

function hrefFunction(table)
{
	// Returns a function that gives the address of URL for a given element of the <table>
	return function(dx, m_list) {
		m_list = (typeof(m_list) !== 'undefined') ? m_list : [];
		if (Dwr.search.Mdx >= 0 && PageContents == Dwr.PAGE_MEDIA)
		{
			m_list = Dwr.search.ImgList;
		}
		var searchStringArgs = {
			MapExpanded: false,
			ImgList: m_list
		};
		dx = (typeof(dx) !== 'undefined') ? dx : Dwr.search[SearchStringField[table]];
		searchStringArgs[SearchStringField[table]] = dx;
		var url = PageFile[table] + '?' + Dwr.BuildSearchString(searchStringArgs);
		return(url);
	}
}

function refFunction(table)
{
	// Returns a function that leaves the current page and goes to the page of a given element of the <table>
	var f_url = hrefFunction(table);
	return function(dx, m_list) {
		window.location.href = f_url(dx, m_list);
		return(false);
	}
}

function optimizedHrefFunction(table)
{
	// Optimized version for hrefFunction
	// The search string is built only once for all
	// The returned function does not check for undefined parameter.
	// No possibility to specify a list of media
	var searchStringArgs = {
		MapExpanded: false // Reset map
	};
	var old_dx = Dwr.search[SearchStringField[table]];
	Dwr.search[SearchStringField[table]] = -1;
	var url = PageFile[table] + '?' + Dwr.BuildSearchString(searchStringArgs) + '&' + UrlField[table] + '=';
	Dwr.search[SearchStringField[table]] = old_dx;
	return function(dx) {
		return(url + dx);
	}
}

var indiHref = hrefFunction('I');
var indiRef = refFunction('I');
var famHref = hrefFunction('F');
var famRef = refFunction('F');
var mediaHref = hrefFunction('M');
var mediaRef = refFunction('M');
var sourceHref = hrefFunction('S');
var sourceRef = refFunction('S');
var placeHref = hrefFunction('P');
var placeRef = refFunction('P');
var repoHref = hrefFunction('R');
var repoRef = refFunction('R');
var eventHref = hrefFunction('E');
var eventRef = refFunction('E');
var noteHref = hrefFunction('T');
var noteRef = refFunction('T');
var surnameHref = hrefFunction('N');
var surnameRef = refFunction('N');

DwrClass.prototype.indiHref = indiHref;
DwrClass.prototype.indiRef = indiRef;
DwrClass.prototype.famHref = famHref;
DwrClass.prototype.famRef = famRef;
DwrClass.prototype.mediaHref = mediaHref;
DwrClass.prototype.mediaRef = mediaRef;
DwrClass.prototype.sourceHref = sourceHref;
DwrClass.prototype.sourceRef = sourceRef;
DwrClass.prototype.placeHref = placeHref;
DwrClass.prototype.placeRef = placeRef;
DwrClass.prototype.repoHref = repoHref;
DwrClass.prototype.repoRef = repoRef;
DwrClass.prototype.eventHref = eventHref;
DwrClass.prototype.eventRef = eventRef;
DwrClass.prototype.noteHref = noteHref;
DwrClass.prototype.noteRef = noteRef;
DwrClass.prototype.surnameHref = surnameHref;
DwrClass.prototype.surnameRef = surnameRef;

var indiHrefOptimized;
var famHrefOptimized;
var mediaHrefOptimized;
var sourceHrefOptimized;
var placeHrefOptimized;
var repoHrefOptimized;
var eventHrefOptimized;
var noteHrefOptimized;
var surnameHrefOptimized;

function computeOptimizedHref()
{
	indiHrefOptimized = optimizedHrefFunction('I');
	famHrefOptimized = optimizedHrefFunction('F');
	mediaHrefOptimized = optimizedHrefFunction('M');
	sourceHrefOptimized = optimizedHrefFunction('S');
	placeHrefOptimized = optimizedHrefFunction('P');
	repoHrefOptimized = optimizedHrefFunction('R');
	eventHrefOptimized = optimizedHrefFunction('E');
	noteHrefOptimized = optimizedHrefFunction('T');
	surnameHrefOptimized = optimizedHrefFunction('N');
}

function m_list_from_mr(mr_list)
{
	// Build a list of the media referenced in the list of media reference structure
	// This list is used for numbering media in the pagination (see printMedia)
	var m_list = [];
	for (var j = 0; j < mr_list.length; j++)
		m_list[j] = mr_list[j].m_idx;
	return(m_list);
}

function searchHref()
{
	// Get the search page address
	return('search.html?' + Dwr.BuildSearchString());
}
DwrClass.prototype.searchHref = searchHref;

DwrClass.prototype.svgHref = function(idx, expand)
{
	// Get the SVG tree page
	if (typeof(idx) === 'undefined') idx = Dwr.search.Idx;
	if (typeof(expand) === 'undefined') expand = Dwr.search.SvgExpanded;
	var page;
	if (expand)
	{
		page = 'tree_svg_full.html';
	}
	else
	{
		page = 'tree_svg.html';
	}
	return(page + '?' + Dwr.BuildSearchString({
		Idx: idx,
		SvgExpanded: expand,
	}));
}

DwrClass.prototype.svgRef = function(idx, expand)
{
	// Go to the SVG tree page
	window.location.href = Dwr.svgHref(idx, expand);
	return(false);
}

DwrClass.prototype.svgConfRef = function()
{
	// Go to the SVG tree configuration page
	window.location.href = 'tree_svg_conf.html?' + Dwr.BuildSearchString();
	return(false);
}

DwrClass.prototype.svgSaveRef = function()
{
	// Go to the SVG tree save-as page
	window.location.href = 'tree_svg_save.html?' + Dwr.BuildSearchString();
	return(false);
}

DwrClass.prototype.helpConfRef = function()
{
	// Go to the configuration help page
	window.location.href = 'https://gramps-project.org/wiki/index.php?title=' + _('DynamicWeb_report#HelpConf');
	return(false);
}

DwrClass.prototype.helpTreeConfRef = function()
{
	// Go to the SVG tree configuration help page
	window.location.href = 'https://gramps-project.org/wiki/index.php?title=' + _('DynamicWeb_report#HelpTreeConf');
	return(false);
}

DwrClass.prototype.helpTreeNavRef = function()
{
	// Go to the SVG tree navigation help page
	window.location.href = 'https://gramps-project.org/wiki/index.php?title=' + _('DynamicWeb_report#HelpTreeNav');
	return(false);
}


//=================================================================
//====================================================== Duplicates
//=================================================================

// List of the persons index 'idx' of table 'I', that appear several times in the ancestors or descendants of the center person
var duplicates = [];


function searchDuplicate(idx)
{
	// Recursively search for duplicates in ancestors and descendants of person 'idx'
	// The search is limited to Dwr.search.Asc ascending generations and Dwr.search.Dsc descending generations

	duplicates = [];
	searchDuplicateAsc(idx, Dwr.search.Asc, []);
	searchDuplicateDsc(idx, Dwr.search.Dsc, []);
}


function searchDuplicateAsc(idx, lev, found)
{
	// Recursively search for duplicates in ancestors of person 'idx',
	// limited to <lev> generations.
	// <found> contains all the persons found in the tree traversal

	if (($.inArray(idx, found) >= 0) && ($.inArray(idx, duplicates) < 0))
	{
		duplicates.push(idx);
		return;
	}
	found.push(idx);
	if (lev <= 0) return;
	for (var x_fam = 0; x_fam < I(idx, 'famc').length; x_fam++)
	{
		var spou = F(I(idx, 'famc')[x_fam].index, 'spou');
		for (var x_spou = 0; x_spou < spou.length; x_spou++)
			searchDuplicateAsc(spou[x_spou], lev - 1, found);
	}
}


function searchDuplicateDsc(idx, lev, found)
{
	// Recursively search for duplicates in descendants of person 'idx',
	// limited to <lev> generations.
	// <found> contains all the persons found in the tree traversal

	if (($.inArray(idx, found) >= 0) && ($.inArray(idx, duplicates) < 0))
	{
		duplicates.push(idx);
	}
	found.push(idx);
	if (lev <= 0) return;
	for (var x_fam = 0; x_fam < I(idx, 'fams').length; x_fam++)
	{
		PreloadScripts(NameFieldScripts('F', I(idx, 'fams')[x_fam], ['spou', 'chil']), true);
		var spou = F(I(idx, 'fams')[x_fam], 'spou');
		var chil = F(I(idx, 'fams')[x_fam], 'chil');
		if (!isDuplicate(idx))
			for (var x_chil = 0; x_chil < chil.length; x_chil++)
				searchDuplicateDsc(chil[x_chil].index, lev - 1, found);
		for (var x_spou = 0; x_spou < chil.length; x_spou++)
			if (idx != spou[x_spou])
				searchDuplicateDsc(spou[x_spou], -1, found);
	}
}


function isDuplicate(idx)
{
	return($.inArray(idx, duplicates) >= 0);
}
DwrClass.prototype.isDuplicate = isDuplicate;


//=================================================================
//================================= Text for individuals / families
//=================================================================

function empty(txt)
{
	return '<span class="dwr-empty">' + txt + '</span>';
}

function indiLinked(idx, citations)
{
	PreloadScripts(NameFieldScripts('I', idx, ['name', 'birth_date', 'death_date', 'gid', 'cita']), true);
	citations = (typeof(citations) !== 'undefined') ? citations : true;
	var txt = I(idx, 'name')
	txt += gidBadge(I(idx, 'gid'));
	txt += indiDates(I(idx, 'birth_date'), I(idx, 'death_date'));
	if (citations) txt += citaLinks(I(idx, 'cita'));
	if (idx != Dwr.search.Idx || PageContents != Dwr.PAGE_INDI)
		txt = '<a href="' + indiHref(idx) + '">' + txt + '</a>';
	return(txt);
}

function indiDates(bdate, ddate)
{
	if (bdate && ddate) return ' ' + _('(b. %(birthdate)s, d. %(deathdate)s)').replace('%(birthdate)s', bdate).replace('%(deathdate)s', ddate);
	if (bdate) return ' ' + _('(b. %s)').replace('%s', bdate);
	if (ddate) return ' ' + _('(d. %s)').replace('%s', ddate);
	return '';
}

function gidBadge(gid)
{
	var txt = '';
	if (!Dwr.search.HideGid) txt = ' <span class="dwr-gid">[' + gid + ']</span>';
	return(txt);
}

var GENDERS_TEXT = {
	'M': _('Male'),
	'F': _('Female'),
	'U': _('Unknown')
};
var GENDERS_TEXT_ORDER = [
	GENDERS_TEXT['M'],
	GENDERS_TEXT['F'],
	GENDERS_TEXT['U']
];

function indiDetails(idx)
{
	PreloadScripts(NameFieldScripts('I', idx, ['names', 'gender', 'death_age']), true);
	var txt = '';
	var x_name;
	txt += '<table class="table table-condensed table-bordered dwr-table-flat">';
	// txt += '<table class="dt-table dwr-table-flat">';
	for (x_name = 0; x_name < I(idx, 'names').length; x_name++)
	{
		var name = I(idx, 'names')[x_name];
		var name_full = name.full;
		if (name.date != '') name_full += ' (' + name.date + ')';
		if (name.cita.length > 0) name_full += citaLinks(name.cita);
		txt += '<tr><td class="dwr-attr-title">' + name.type + '</td><td colspan="2" class="dwr-attr-value">' + name_full + '</td></tr>';
		if (name.nick != '') txt += '<tr><td class="empty"></td><td class="dwr-attr-title">' + _('Nick Name') + '</td><td class="dwr-attr-value">' + name.nick + '</td></tr>';
		if (name.call != '') txt += '<tr><td class="empty"></td><td class="dwr-attr-title">' + _('Call Name') + '</td><td class="dwr-attr-value">' + name.call + '</td></tr>';
		if (name.fam_nick != '') txt += '<tr><td class="empty"></td><td class="dwr-attr-title">' + _('Family Nick Name') + '</td><td class="dwr-attr-value">' + name.fam_nick + '</td></tr>';
		if (name.notes.length != '') txt += '<tr><td class="empty"></td><td class="dwr-attr-title">' + _('Notes') + '</td><td class="dwr-attr-value">' + NotesString(name.notes, '<p class="dwr-attr-value">') + '</td></tr>';
	}
	txt += '<tr><td class="dwr-attr-title">' + _('Gender') + '</td><td colspan="2" class="dwr-attr-value">' + GENDERS_TEXT[I(idx, 'gender')] + '</td></tr>';
	if (I(idx, 'death_age') != '') txt += '<tr><td class="dwr-attr-title">' + _('Age at death') + '</td><td colspan="2" class="dwr-attr-value">' + I(idx, 'death_age') + '</td></tr>';
	txt += '</table>';
	return(txt);
}


function famLinked(fdx, citations)
{
	PreloadScripts(NameFieldScripts('F', fdx, ['name', 'gid', 'cita']), true);
	citations = (typeof(citations) !== 'undefined') ? citations : true;
	var txt =F(fdx, 'name');
	txt += gidBadge(F(fdx, 'gid'));
	if (citations) txt += citaLinks(F(fdx, 'cita'));
	if (DwrConf.inc_families_pages && (fdx != Dwr.search.Fdx || PageContents != Dwr.PAGE_FAM))
		txt = '<a href="' + famHref(fdx) + '">' + txt + '</a>';
	return(txt);
}

function famDates(mdate)
{
	if (mdate) return ' ' + _('(m. %s)').replace('%s', mdate);
	return '';
}


function noteSection(notes)
{
	if (notes.length == 0) return([]);
	return([{
		title: _('Notes'),
		text: NotesString(notes, '<p>')
	}]);
}


function mediaSection(media)
{
	if (media.length == 0) return([]);
	return([{
		title: _('Media'),
		text: mediaLinks(media),
		panelclass: 'dwr-panel-media'
	}]);
}


function eventLinked(edx, citations)
{
	PreloadScripts(NameFieldScripts('E', edx, ['type', 'gid']), true);
	citations = (typeof(citations) !== 'undefined') ? citations : true;
	var txt = E(edx, 'type')
	txt += gidBadge(E(edx, 'gid'));
	if (citations) txt += citaLinks(E(edx, 'cita'));
	if (DwrConf.inc_events_pages)
	{
		txt = '<a href="' + eventHref(edx) + '">' + txt + '</a>';
	}
	return(txt);
}


function eventTable(events, idx, fdx)
{
	if (events.length == 0) return([]);
	var contents = {};
	contents.title = _('Events');
	var txt = '';
	txt += '<table class="table table-condensed table-bordered dwr-table-panel">';
	// txt += '<table class="dt-table events">';
	txt += '<thead><tr>';
	txt += '<th class="dwr-attr-header">' + _('Event') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Date') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Place') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Notes') + '</th>';
	txt += '</tr></thead><tbody>';
	for (var j = 0; j < events.length; j++)
	{
		var eref = events[j];
		var edx = eref.event;
		var cita = $.extend([], eref.cita, E(edx, 'cita'));
		txt += '<tr>';
		txt += '<td class="dwr-attr-title">' + eventLinked(edx) + '</td>';
		txt += '<td class="dwr-attr-value">' + E(edx, 'date') + '</td>';
		txt += '<td class="dwr-attr-value">' + placeLink(E(edx, 'place'), idx, fdx, edx) + '</td>';
		var notes = [];
		if (E(edx, 'descr') != '') notes.push('<span class="dwr-attr-header">' + _('Description') + '</span>:<br>' + E(edx, 'descr'));
		if (eref.notes.length > 0 || E(edx, 'notes').length > 0) notes.push('<span class="dwr-attr-header">' + _('Notes') + '</span>:' +
			'<br>' + NotesString(eref.notes, '<p>') +
			'<br>' + NotesString(E(edx, 'notes'), '<p>'));
		var mlinks = mediaLinks(E(edx, 'media'));
		if (mlinks != '') notes.push('<span class="dwr-attr-header">' + _('Media') + '</span>:<br>' + mlinks);
		// Get participants
		var participants = '';
		for (var i = 0; i < E(edx, 'bki').length; i += 1)
		{
			var p_idx = E(edx, 'bki')[i].bk_idx;
			if (p_idx != idx) participants += '<br>' + indiLinked(p_idx, false);
		}
		for (var i = 0; i < E(edx, 'bkf').length; i += 1)
		{
			var p_fdx = E(edx, 'bkf')[i].bk_idx;
			if (p_fdx != fdx) participants += '<br>' + indiLinked(p_fdx, false);
		}
		if (participants != '') notes.push('<span class="dwr-attr-header">' + _('Other participants') + '</span>:' + participants);
		// Build notes from notes + description + media + participants + etc.
		txt += '<td class="dwr-attr-value">' + notes.join('<p>') + '</td>';
		txt += '</tr>';
	}
	txt += '</tbody></table>';
	contents.text = txt;
	return([contents]);
}


function locationString(loc)
{
	var loc2 = [];
	for (var x_loc = 0; x_loc < loc.length; x_loc++)
		if (loc[x_loc] != '') loc2.push(loc[x_loc]);
	return(loc2.join(', '));
}


function addrsTable(addrs)
{
	if (addrs.length == 0) return([]);
	var contents = {};
	contents.title = _('Addresses');
	var txt = '';
	txt += '<table class="table table-condensed table-bordered dwr-table-panel">';
	// txt += '<table class="dt-table addrs">';
	txt += '<thead><tr>';
	txt += '<th class="dwr-attr-header">' + _('Address') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Date') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Notes') + '</th>';
	txt += '</tr></thead><tbody>';
	for (var x_addr = 0; x_addr < addrs.length; x_addr++)
	{
		var addr = addrs[x_addr];
		txt += '<tr>';
		txt += '<td class="dwr-attr-value">' + locationString(addr.location) + citaLinks(addr.cita) + '</td>';
		txt += '<td class="dwr-attr-value">' + addr.date + '</td>';
		txt += '<td class="dwr-attr-value">' + NotesString(addr.notes, '<p>') + '</td>';
		txt += '</tr>';
	}
	txt += '</tbody></table>';
	contents.text = txt;
	return([contents]);
}


function attrsTable(attrs)
{
	if (attrs.length == 0) return([]);
	var contents = {};
	contents.title = _('Attributes');
	var txt = '';
	txt += '<table class="table table-condensed table-bordered dwr-table-panel">';
	// txt += '<table class="dt-table attrs">';
	txt += '<thead><tr>';
	txt += '<th class="dwr-attr-header">' + _('Attribute') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Value') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Notes') + '</th>';
	txt += '</tr></thead><tbody>';
	for (var x_attr = 0; x_attr < attrs.length; x_attr++)
	{
		var a = attrs[x_attr];
		txt += '<tr>';
		txt += '<td class="dwr-attr-title">' + a.type + citaLinks(a.cita) + '</td>';
		txt += '<td class="dwr-attr-value">' + a.value + '</td>';
		txt += '<td class="dwr-attr-value">' + NotesString(a.notes, '<p>') + '</td>';
		txt += '</tr>';
	}
	txt += '</tbody></table>';
	contents.text = txt;
	return([contents]);
}


function urlsTable(urls)
{
	if (urls.length == 0) return([]);
	var contents = {};
	contents.title = _('Web Links');
	var txt = '';
	txt += '<table class="table table-condensed table-bordered dwr-table-panel">';
	// txt += '<table class="dt-table urls">';
	txt += '<thead><tr>';
	txt += '<th class="dwr-attr-header">' + _('Link') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Description') + '</th>';
	txt += '</tr></thead><tbody>';
	for (var x_url = 0; x_url < urls.length; x_url++)
	{
		var url = urls[x_url];
		txt += '<tr>';
		txt += '<td class="dwr-attr-value"><a href="' + url.uri + '">' + url.uri + '</a></td>';
		txt += '<td class="dwr-attr-value">' + url.descr + '</td>';
		txt += '</tr>';
	}
	txt += '</tbody></table>';
	contents.text = txt;
	return([contents]);
}


function assocsTable(assocs)
{
	if (assocs.length == 0) return([]);
	var contents = {};
	contents.title = _('Associations');
	var txt = '';
	txt += '<table class="table table-condensed table-bordered dwr-table-panel">';
	// txt += '<table class="dt-table assocs">';
	txt += '<thead><tr>';
	txt += '<th class="dwr-attr-header">' + _('Person') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Relationship') + '</th>';
	txt += '<th class="dwr-attr-header">' + _('Notes') + '</th>';
	txt += '</tr></thead><tbody>';
	for (var x_assoc = 0; x_assoc < assocs.length; x_assoc++)
	{
		var assoc = assocs[x_assoc];
		txt += '<tr>';
		txt += '<td class="dwr-attr-value">' + indiLinked(assoc.person, false) + '</td>';
		txt += '<td class="dwr-attr-value">' + assoc.relationship + citaLinks(assoc.cita) + '</td>';
		txt += '<td class="dwr-attr-value">' + NotesString(assoc.notes, '<p>') + '</td>';
		txt += '</tr>';
	}
	txt += '</tbody></table>';
	contents.text = txt;
	return([contents]);
}


function NotesString(notes, p)
{
	if (notes.length == 0) return '';
	var txt = '';
	for (var i = 0; i < notes.length; i += 1)
	{
		var tdx = notes[i];
		if (DwrConf.print_notes_type || DwrConf.inc_notes_pages)
		{
			txt += '<p>';
			if (DwrConf.inc_notes_pages) txt += '<a href="' + noteHref(tdx) + '" class="dwr-note-type">';
			txt += T(tdx, 'type');
			if (DwrConf.inc_notes_pages) txt += '</a>';
			txt += gidBadge(T(tdx, 'gid'));
			txt += '</p>';
		}
		txt += NoteText(T(tdx, 'text'), p);
	}
	return txt;
}

function NoteText(text, p)
{
	if (text.indexOf('<div>') == -1 && text.indexOf('<p>') == -1)
		text = p + text + '</p>';
	return text;
}

function GetFirstLine(text)
{
	text = text
		.replace(/\n/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.replace(/^\s+|\s+$/g, '');
	var maxlen = 40;
	maxlen += text.length - text.replace(/&[a-z]+;/gi, '&').length;
	if (text.length > maxlen)
	{
		text = text.substr(0, maxlen) + '&hellip;';
	}
	return text;
}


var pageSources = [];
var pageCitations = [];
var pageCitationsBullets = [];

function citaLinks(cita)
{
	var txt = '';
	var j, k;
	for (j = 0; j < cita.length; j++)
	{
		var cdx = cita[j];
		var sdx = C(cdx, 'source');
		PreloadScripts([].concat.apply([], [
			NameFieldScripts('C', cdx, ['source', 'media', 'text', 'notes']),
			NameFieldScripts('S', sdx, ['author', 'title', 'gid'])]),
			true);
		var title = sourName(sdx);
		if (title != '') title=' title="' + title + '"';
		// Check if source is already referenced
		var x1 = $.inArray(sdx, pageSources);
		if (x1 == -1)
		{
			x1 = pageSources.length;
			pageSources[x1] = sdx;
			pageCitations[x1] = [];
		}
		var x2 = pageCitations[x1].length;
		// Check if citation already exists
		var c_m = mediaLinks(C(cdx, 'media'))
		var c_n = NotesString(C(cdx, 'notes'), '<p>')
		for (k = 0; k < pageCitations[x1].length; k++)
		{
			var cdx2 = pageCitations[x1][k];
			var c2_m = mediaLinks(C(cdx2, 'media'));
			var c2_n = NotesString(C(cdx2, 'notes'), '<p>')
			if (C(cdx2, 'text') == C(cdx, 'text') &&
				c2_n == c_n &&
				c2_m == c_m)
			{
				x2 = k;
				break;
			}
		}
		pageCitations[x1][x2] = cita[j];
		// Reference text
		txt += ' <a class="dwr-citation label label-primary" href="#cita_' + sdx + '"' + title + '>' + x1 + ',' + x2 + '</a> ';
	}
	return(txt);
}

function sourceSection()
{
	// Citations and source references
	var ctxt = printCitations();
	if (ctxt == '') return([]);
	return([{
		title: _('Sources'),
		text: ctxt,
		panelclass: 'dwr-sources-panel'
	}]);
}

function printCitations()
{
	if (pageSources.length == 0) return('');
	var txt = '';
	var j, k;
	// Print output
	txt += '<ol>';
	for (j = 0; j < pageSources.length; j++)
	{
		var sdx = pageSources[j];
		txt += '<li><a name="cita_' + sdx + '" href="' + sourceHref(sdx) + '">';
		txt += sourName(sdx) + '</a>';
		var txts = '';
		pageCitationsBullets[j] = [];
		for (k = 0; k < pageCitations[j].length; k++)
		{
			var cdx = pageCitations[j][k];
			var txtc = C(cdx, 'text') + NotesString(C(cdx, 'notes'), '<p>') + mediaLinks(C(cdx, 'media'))
			if (txtc != '')
			{
				txts += '<li>' + txtc + '</li>';
				pageCitationsBullets[j][k] = (j + 1) + citationBullet(k);
			}
			else
			{
				pageCitationsBullets[j][k] = (j + 1) + '';
			}
		}
		if (txts != '') txt += '<ol style="list-style-type: lower-alpha">' + txts + '</ol>';
		txt += '</li>';
	}
	txt += '</ol>';
	return(txt);
}

function HandleCitations()
{
	// Replace references text by the list index
	$('.dwr-citation').each(function(i, e) {
		var txt = $(this).text();
		var x = txt.split(',');
		$(this).text(pageCitationsBullets[x[0]][x[1]]);
	});
	// Show Source tabbed pane upon click

	$('.dwr-citation').click(function(e) {
		$('a.dwr-sources-panel[role=tab]').tab('show');
	});
}

function citationBullet(x2)
{
	var num = '';
	num = String.fromCharCode('a'.charCodeAt(0) + (x2 % 26)) + num;
	x2 = Math.floor(x2 / 26);
	if (x2 > 0) num = String.fromCharCode('a'.charCodeAt(0) + (x2 % 27) - 1) + num;
	x2 = Math.floor(x2 / 27);
	if (x2 > 0) num = String.fromCharCode('a'.charCodeAt(0) + (x2 % 27) - 1) + num;
	x2 = Math.floor(x2 / 27);
	if (x2 > 0) num = String.fromCharCode('a'.charCodeAt(0) + (x2 % 27) - 1) + num;
	x2 = Math.floor(x2 / 27);
	if (x2 > 0) num = String.fromCharCode('a'.charCodeAt(0) + (x2 % 27) - 1) + num;
	x2 = Math.floor(x2 / 27);
	if (x2 > 0) num = String.fromCharCode('a'.charCodeAt(0) + (x2 % 27) - 1) + num;
	x2 = Math.floor(x2 / 27);
	return(num);
}

function sourName(sdx)
{
	var title = '';
	if (Dwr.search.SourceAuthorInTitle && S(sdx, 'author') != '') title = S(sdx, 'author');
	if (S(sdx, 'title') != '')
	{
		if (title != '') title += ': ';
		title += S(sdx, 'title');
	}
	if (title != '') return(title);
	return(_('Source') + ' ' + S(sdx, 'gid'));
}


function mediaName(mdx)
{
	var txt = '';
	if (M(mdx, 'title') != '') return(M(mdx, 'title'));
	return(M(mdx, 'gramps_path'));
}


// List of places referenced in the page with for each one:
//    - pdx: the place index in table P
//    - idx: the referencing person index in table I, -1 if none
//    - fdx: the referencing family index in table F, -1 if none
//    - edx: the referencing event index in table E, -1 if none
var pagePlaces = [];


function placeLink(pdx, idx, fdx, edx)
{
	if (typeof(idx) === 'undefined') idx = -1;
	if (typeof(fdx) === 'undefined') fdx = -1;
	if (typeof(edx) === 'undefined') edx = -1;
	if (pdx == -1) return('');
	pagePlaces.push({pdx: pdx, idx: idx, fdx: fdx, edx: edx});
	var txt = P(pdx, 'name');
	txt += gidBadge(P(pdx, 'gid'));
	if (DwrConf.inc_places_pages &&
		(PageContents != Dwr.PAGE_PLACE || pdx != Dwr.search.Pdx))
	{
		txt = '<a href="' + placeHref(pdx) + '">' + txt + '</a>';
	}
	return txt;
}


function repoLink(rdx)
{
	if (rdx == -1) return('');
	if (PageContents == Dwr.PAGE_REPO && rdx == Dwr.search.Rdx) return(R(rdx, 'name'));
	return('<a href="' + repoHref(rdx) + '">' + R(rdx, 'name') + '</a>');
}


function strToContents(title, txt)
{
	if (txt == '') return([]);
	return([{
		title: title,
		text: txt
	}]);
}


//=================================================================
//========================================================== Titles
//=================================================================

var titlesCollapsible = []; // Stack of titles property: is the title collapsible ?
var titlesTable = []; // Stack of titles property: is the title containing a table ?


function PrintTitle(section_id, level, contents, collapsible, is_tabbeb, collapsed)
{
	if (contents.length == 0) return('');
	if (typeof(is_tabbeb) === 'undefined') is_tabbeb = false;
	if (typeof(collapsible) === 'undefined') collapsible = (level >= 1);
	if (typeof(collapsed) === 'undefined') collapsed = false;
	is_tabbeb = is_tabbeb && collapsible && Dwr.search.TabbedPanels;
	var lsName = 'lastTab:' + window.location.pathname + ':' + section_id;
    var lastTab = parseInt(sessionStorage.getItem(lsName));
	if (isNaN(lastTab)) lastTab = 0;
	if (lastTab >= contents.length) lastTab = contents.length - 1;
	var html = '';
	if (is_tabbeb)
	{
		//  Generate nav tabs
		html += '<ul id="' + section_id + '"class="nav nav-tabs" role="tablist">';
		for (var i = 0; i < contents.length; i += 1)
		{
			var id = 'section_' + section_id + '_' + i;
			if (typeof(contents[i].panelclass) === 'undefined') contents[i].panelclass = '';
			html += '<li role="presentation"' + ((i == lastTab) ? ' class="active"' : '') +
				'><a href="#' + id + '" role="tab" data-toggle="tab" class="' + contents[i].panelclass + '">' +
				'<h' + level + ' class="panel-title">' +
				contents[i].title +
				'</h' + level + '>' +
				'</a></li>';
		}
		html += '</ul>';
		html += '<div class="panel panel-default dwr-tab-panel"><div class="tab-content panel-body">';
	}
	for (var i = 0; i < contents.length; i += 1)
	{
		var id = 'section_' + section_id + '_' + i;
		var is_table = (contents[i].text.indexOf('<table') == 0);
		is_table = is_table && collapsible;
		if (is_tabbeb)
		{
			html += '<div id="' + id + '" role="tabpanel" class="tab-pane' +
				(is_table ? ' dwr-panel-table' : '') +
				((i == lastTab) ? ' active ' : ' ') + contents[i].panelclass + '">';
			html += contents[i].text;
			html += '</div>';
		}
		else if (collapsible)
		{
			var lsName = 'wasCollapsed:' + window.location.pathname + ':' + id;
			var wasCollapsed = parseInt(sessionStorage.getItem(lsName));
			var collapse = collapsed;
			if (!isNaN(wasCollapsed)) collapse = wasCollapsed;
			html += '<div class="panel panel-default ' + contents[i].panelclass + '">';
			html += '<div class="panel-heading dwr-collapsible' +
				(collapse ? ' collapsed' : '') +
				'" data-toggle="collapse" data-target="#' + id + '">';
			html += '<h' + level + ' class="panel-title">' + contents[i].title + '</h' + level + '>';
			html += '</div>';
			html += '<div id="' + id + '" class="panel-collapse collapse' +
				(collapse ? '' : ' in') +
				(is_table ? ' dwr-panel-table' : ' dwr-panel') +
				'">';
			if (is_table)
			{
				html += contents[i].text;
				html += '</div></div>';
			}
			else
			{
				html += '<div class="panel-body">';
				html += contents[i].text;
				html += '</div></div></div>';
			}

		}
		else
		{
			html += '<h' + level + '>' + contents[i].title + '</h' + level + '>';
			html += contents[i].text;
		}
	}
	if (is_tabbeb)
	{
		html += '</div></div>';
	}
	return(html);
}


function HandleTitles()
{
	// Handle collapsible panels
	$('.panel-heading').click(function(event) {
		// Prevent title collapse when the click is not on the title (on text hyperlink for example)
		var target = $(event.target);
		if (!target.is('.panel-heading') && !target.is('.panel-title'))
		{
			event.stopImmediatePropagation();
		}
	});


	// Handle Bootstrap nav tabs
	$('.nav-tabs>li>a').click(function (event) {
		// Prevent title collapse when the click is not on the title (on text hyperlink for example)
		var target = $(event.target);
		if (target.attr('role') != 'tab' && !target.is('.panel-title'))
		{
			event.stopImmediatePropagation();
		}
	});

	// Collapsed section memorization
    // $('div[data-toggle="collapse"]')
    $('.panel-collapse.collapse')
		.on('hidden.bs.collapse', function (event) {
			var lsName = 'wasCollapsed:' + window.location.pathname + ':' + $(this).attr('id');
			sessionStorage.setItem(lsName, '1')
			event.stopPropagation();
		})
		.on('shown.bs.collapse', function (event) {
			var lsName = 'wasCollapsed:' + window.location.pathname + ':' + $(this).attr('id');
			sessionStorage.setItem(lsName, '0');
			event.stopPropagation();
		});

	// Selected tab memorization
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (event) {
		var section_id = $(this).parent().parent().attr('id');
		var lsName = 'lastTab:' + window.location.pathname + ':' + section_id;
        sessionStorage.setItem(lsName, $(this).attr('href').replace('#section_' + section_id + '_', ''));
		event.stopPropagation();
    });

	// Enable Bootstrap tooltips and popovers
	$('[data-toggle=tooltip]').tooltip();
	$('[data-toggle=popover]').popover();
}


function printChangeTime(change_time)
{
	$('#dwr-change-time').html(_('Last Modified') + ': ' + change_time);
	return('');
}

//=================================================================
//====================================================== Individual
//=================================================================

function printIndi(idx)
{
	PreloadScripts(NameFieldScripts('I', idx, ['name', 'gid', 'cita', 'events', 'addrs', 'attr', 'urls', 'assoc', 'media', 'notes', 'change_time', 'famc', 'fams']), true);
	var html = '';
	html += '<h2 class="page-header">' + I(idx, 'name') + gidBadge(I(idx, 'gid')) + citaLinks(I(idx, 'cita')) + '</h2>';

	html += indiDetails(idx);
	html += PrintTitle('I' + idx, 3, [].concat(
		eventTable(I(idx, 'events'), idx, -1),
		addrsTable(I(idx, 'addrs')),
		attrsTable(I(idx, 'attr')),
		urlsTable(I(idx, 'urls')),
		assocsTable(I(idx, 'assoc')),
		mediaSection(I(idx, 'media')),
		noteSection(I(idx, 'notes')),
		[{
			title: _('Ancestors'),
			text: printIndiAncestors(idx)
		},
		{
			title: _('Descendants'),
			text: printIndiDescendants(idx)
		}],
		printMap(Dwr.search.MapFamily),
		sourceSection()),
		true /*collapsible*/, true /*is_tabbeb*/);
	html += printChangeTime(I(idx, 'change_time'));
	return(html);
}


function printIndiAncestors(idx)
{
	var html = '';
	var famc_list = $.map(I(idx, 'famc'), function (fc) {return fc.index});
	if (DwrConf.show_all_siblings)
	{
		for (var j = 0; j < I(idx, 'famc').length; j++)
		{
			var fdx = I(idx, 'famc')[j].index;
			for (var k = 0; k < F(fdx, 'spou').length; k++)
			{
				var fams = I(F(fdx, 'spou')[k], 'fams');
				for (var x_fams = 0; x_fams < fams.length; x_fams++)
				{
					var fdx2 = fams[x_fams];
					if ($.inArray(fdx2, famc_list) < 0) famc_list.push(fdx2);
				}
			}
		}
	}
	for (var j = 0; j < famc_list.length; j++)
	{
		var fdx = famc_list[j];
		html += PrintTitle('Idsc' + idx, 4,
			[{
				title: _('Parents') + ': ' + famLinked(fdx),
				text: printIndiParents(fdx)
			},
			{
				title: _('Siblings'),
				text: printIndiSiblings(fdx)
			}]);
	}
	if (famc_list.length == 0) html += ('<p class="dwr-ref">' + _('None'));
	return(html);
}


function printIndiParents(fdx)
{
	var html = '';
	if (F(fdx, 'spou').length == 0)
	{
		html += ('<p class="dwr-ref">' + _('None'));
	}
	else
	{
		for (var k = 0; k < F(fdx, 'spou').length; k++)
		{
			html += '<p class="dwr-ref">' + indiLinked(F(fdx, 'spou')[k]) + '</p>';
		}
	}
	return(html);
}


function printIndiSiblings(fdx)
{
	var html = '';
	if (F(fdx, 'chil').length > 0)
	{
		html += '<ol class="dwr-ref">';
		for (var k = 0; k < F(fdx, 'chil').length; k++)
		{
			html += '<li class="dwr-ref">';
			html += printChildRef(F(fdx, 'chil')[k]);
			html += '</li>';
		}
		html += '</ol>';
	}
	else
	{
		html += ('<p class="dwr-ref">' + _('None'));
	}
	return(html);
}


function printIndiDescendants(idx)
{
	var html = '';
	for (var j = 0; j < I(idx, 'fams').length; j++)
	{
		var fdx = I(idx, 'fams')[j];
		html += PrintTitle('Iasc' + idx, 4,
			[{
				title: famLinked(fdx),
				text: printIndiSpouses(fdx, idx)
			}],
			I(idx, 'fams').length > 1 /*collapsible*/);
	}
	if (I(idx, 'fams').length == 0) html += ('<p class="dwr-ref">' + _('None') + '</p>');
	return(html);
}


function printIndiSpouses(fdx, idx)
{
	PreloadScripts(NameFieldScripts('F', fdx, ['events', 'attr', 'media', 'notes']), true);
	var html = '';
	var spouses = $(F(fdx, 'spou')).not([idx]).get();
	for (var k = 0; k < spouses.length; k++)
	{
		html += '<p class="dwr-ref">' + indiLinked(spouses[k]) + '</p>';
	}
	html += PrintTitle('Ispouses' + idx, 4, [].concat(
		[{
			title: _('Children'),
			text: printIndiChildren(fdx)
		}],
		eventTable(F(fdx, 'events'), -1, fdx),
		attrsTable(F(fdx, 'attr')),
		mediaSection(F(fdx, 'media')),
		noteSection(F(fdx, 'notes'))),
		true /*collapsible*/, true /*is_tabbeb*/);
	return(html);
}


function printIndiChildren(fdx)
{
	var html = '';
	if (F(fdx, 'chil').length == 0)
	{
		html += '<p class="dwr-ref">' + _('None') + '</p>';
	}
	else
	{
		html += '<ol class="dwr-ref">';
		for (var k = 0; k < F(fdx, 'chil').length; k++)
		{
			html += '<li class="dwr-ref">';
			html += printChildRef(F(fdx, 'chil')[k]);
			html += '</li>';
		}
		html += '</ol>';
	}
	return(html);
}


function printChildRef(fc)
{
	var txt = '';
	txt += indiLinked(fc.index);
	txt += citaLinks(fc.cita);
	if (fc.notes.lentgh > 0) txt += '<p><b>' + _('Notes') + ':</b></p>' + NotesString(fc.notes, '</p>');
	var rel, title;
	rel = fc.to_father;
	title = _('Relationship to Father');
	if (rel != '' && rel != _('Birth')) txt += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + title + ': </span>' + rel + '</p>';
	rel = fc.to_mother;
	title = _('Relationship to Mother');
	if (rel != '' && rel != _('Birth')) txt += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + title + ': </span>' + rel + '</p>';
	return(txt);
}


//=================================================================
//========================================================== Family
//=================================================================

function printFam(fdx)
{
	PreloadScripts(NameFieldScripts('F', fdx, ['name', 'gid', 'cita', 'events', 'attr', 'media', 'notes', 'change_time', 'spou', 'chil']), true);
	var html = '';
	html += '<h2 class="page-header">' + F(fdx, 'name') + gidBadge(F(fdx, 'gid')) + citaLinks(F(fdx, 'cita')) + '</h2>';
	html += PrintTitle('F' + fdx, 3, [].concat(
		eventTable(F(fdx, 'events'), -1, fdx),
		attrsTable(F(fdx, 'attr')),
		mediaSection(F(fdx, 'media')),
		noteSection(F(fdx, 'notes')),
		[{
			title: _('Parents'),
			text: printFamParents(fdx)
		},
		{
			title: _('Children'),
			text: printFamChildren(fdx)
		}],
		printMap(Dwr.search.MapFamily),
		sourceSection()),
		true /*collapsible*/, true /*is_tabbeb*/);
	html += printChangeTime(F(fdx, 'change_time'));
	return(html);
}

function printFamParents(fdx)
{
	var html = '';
	if (F(fdx, 'spou').length == 0)
	{
		html += ('<p class="dwr-ref">' + _('None'));
	}
	else
	{
		html += '<ul class="dwr-ref-detailed">';
		for (var k = 0; k < F(fdx, 'spou').length; k++)
		{
			var idx = F(fdx, 'spou')[k];
			html += '<li class="dwr-ref-detailed">' + indiLinked(idx);
			html += indiDetails(idx);
			html += PrintTitle('Fparents' + fdx, 4, [].concat(
				eventTable(I(idx, 'events'), idx, -1),
				// addrsTable(I(idx, 'addrs')),
				// attrsTable(I(idx, 'attr')),
				// urlsTable(I(idx, 'urls')),
				// assocsTable(I(idx, 'assoc')),
				mediaSection(I(idx, 'media'))),
				// noteSection(I(idx, 'notes')),
				true /*collapsible*/, true /*is_tabbeb*/);
			html += '</li>';
		}
	}
	return(html);
}


function printFamChildren(fdx)
{
	var html = '';
	if (F(fdx, 'chil').length == 0)
	{
		html += ('<p class="dwr-ref">' + _('None') + '</p>');
	}
	else
	{
		html += '<ol class="dwr-ref-detailed">';
		for (var k = 0; k < F(fdx, 'chil').length; k++)
		{
			var fc = F(fdx, 'chil')[k];
			var idx = F(fdx, 'chil')[k].index;
			html += '<li class="dwr-ref-detailed">' + printChildRef(F(fdx, 'chil')[k])
			html += indiDetails(idx);
			html += PrintTitle('Fchildren' + fdx, 4, [].concat(
				eventTable(I(idx, 'events'), idx, -1),
				// addrsTable(I(idx, 'addrs')),
				// attrsTable(I(idx, 'attr')),
				// urlsTable(I(idx, 'urls')),
				// assocsTable(I(idx, 'assoc')),
				mediaSection(I(idx, 'media'))),
				// noteSection(I(idx, 'notes')),
				true /*collapsible*/, true /*is_tabbeb*/);
			html += '</li>';
		}
		html += '</ol>';
	}
	return(html);
}


//=================================================================
//=========================================================== Media
//=================================================================

function mediaLinks(media)
{
	var scripts = [];
	for (var j = 0; j < media.length; j++)
	{
		var mr = media[j];
		$.merge(scripts, NameFieldScripts('M', media[j].m_idx, ['title', 'gramps_path']));
	}
	PreloadScripts(scripts, true);
	var txt = '';
	for (var j = 0; j < media.length; j++)
	{
		var mr = media[j];
		var alt = M(mr.m_idx, 'title');
		if (alt == '') alt = M(mr.m_idx, 'title');
		if (alt == '') alt = M(mr.m_idx, 'gramps_path');
		if (alt == '') alt = _('Media') + ' ' + mr.m_idx;
		txt += ' <a title="' + alt + '" class="thumbnail" href="' + mediaHref(mr.m_idx, m_list_from_mr(media)) + '">';
		txt += '<img src="' + mr.thumb + '" alt="' + alt + '"></a> ';
	}
	return(txt);
}

function mediaPaginationButtonHtml(id, class_, text)
{
	var html = '<li id="' + id + '"';
	if (class_ != '') html += ' class="' + class_ + '"';
	html += '><a href="#">' + text + '</a></li>';
	return(html);
}

function printMedia(mdx)
{
	PreloadScripts(NameFieldScripts('M', mdx, ['title', 'gramps_path', 'gid', 'cita', 'mime', 'path', 'bki', 'bkf', 'bks', 'bkp', 'bke', 'date', 'notes', 'attr', 'change_time']), true);
	var html = '';
	var title = M(mdx, 'title');
	if (title == '') title = M(mdx, 'gramps_path');
	html += '<h2 class="page-header">' + title + gidBadge(M(mdx, 'gid')) + citaLinks(M(mdx, 'cita')) + '</h2>';

	// Pagination buttons
	if (Dwr.search.ImgList.length > 1)
	{
		var imgI = Dwr.search.ImgList.indexOf(mdx);
		html += '<ul id="dwr-img-btns" class="pagination">';
		// 'Previous' button
		html += mediaPaginationButtonHtml('media_button_prev', (imgI == 0) ? 'disabled' : '',
			'<span class="glyphicon glyphicon-chevron-left"></span>');
		// First item button
		html += mediaPaginationButtonHtml('media_button_0', (imgI == 0) ? 'active' : '', '1');
		var first_but = Math.min(imgI - 1, Dwr.search.ImgList.length - 4);
		first_but = Math.max(1, first_but);
		var last_but = Math.min(first_but + 2, Dwr.search.ImgList.length - 2);
		if (first_but > 1)
		{
			// Separator between first item and current item buttons
			html += mediaPaginationButtonHtml('media_button_hellip', 'disabled', '&hellip;');
		}
		// Current item buttons
		for (var i = first_but; i <= last_but; i++)
		{
			html += mediaPaginationButtonHtml('media_button_' + i, (imgI == i) ? 'active' : '', i + 1);
		}
		if (last_but < Dwr.search.ImgList.length - 2)
		{
			// Separator between current item buttons and last item
			html += mediaPaginationButtonHtml('media_button_hellip', 'disabled', '&hellip;');
		}
		if (Dwr.search.ImgList.length > 1)
		{
			// Last item button
			var i = Dwr.search.ImgList.length - 1;
			html += mediaPaginationButtonHtml('media_button_' + i, (imgI == i) ? 'active' : '', i + 1);
		}
		// 'Next' button
		html += mediaPaginationButtonHtml('media_button_next', (imgI == Dwr.search.ImgList.length - 1) ? 'disabled' : '',
			'<span class="glyphicon glyphicon-chevron-right"></span>');
		html += '</ul>';
		// Pagination events
		$(window).load(function()
		{
			// Disable <a> anchors for disabled buttons
			$('.pagination .disabled a, .pagination .active a').on('click', function(e) {e.preventDefault()});
			// Connect click events
			$('#media_button_prev:not(.disabled)').click(function() {return mediaButtonPageClick(-1)});
			$('#media_button_next:not(.disabled)').click(function() {return mediaButtonPageClick(1)});
			$('#media_button_0:not(.active)').click(function() {return mediaButtonPageClick(0, 0)});
			$('#media_button_' + (Dwr.search.ImgList.length - 1) + ':not(.active)').click(function() {return mediaButtonPageClick(0, Dwr.search.ImgList.length - 1)});
			for (var i = first_but; i <= last_but; i++)
			{
				(function(){ // This is used to create instances of local variables
					var icopy = i;
					$('#media_button_' + i + ':not(.active)').click(function() {return mediaButtonPageClick(0, icopy)});
				})();
			}
		});
	}

	// Image or link (if media is not an image)
	if (M(mdx, 'mime').indexOf('image') == 0)
	{
		html += '<div class="dwr-centered"><div id="dwr-img-div">';
		html += '<img id="dwr-image" src="' + M(mdx, 'path') + '">';
		html += printMediaMap(mdx);

		// Expand button
		html += '<div id="media-buttons">';
		html += '<button id="media-button-max" type="button" class="btn btn-default" title=' + _('Maximize') + '>';
		html += '<span class="glyphicon glyphicon-fullscreen"></span>';
		html += '</button>';
		html += '</div>';

		html += '</div></div>';

		// Expand button events
		$(window).load(function()
		{
			$('#media-button-max').click(function() {return mediaButtonMaxClick()});
		});
	}
	else
	{
		var name = M(mdx, 'gramps_path');
		name = name.replace(/.*[\\\/]/, '');
		html += '<p class="dwr-centered"><a href="' + M(mdx, 'path') + '">' + name + '</a></p>';
	}

	// Back references
	var bk_txt = printBackRefs(BKREF_TYPE_MEDIA, M(mdx, 'bki'), M(mdx, 'bkf'), M(mdx, 'bks'), [], M(mdx, 'bkp'), [], M(mdx, 'bke'));

	// Media description
	if (M(mdx, 'date') != '') html += '<p><b>' + _('Date') + ': </b>' + M(mdx, 'date') + '</p>';
	html += PrintTitle('M' + mdx, 3, [].concat(
		noteSection(M(mdx, 'notes')),
		attrsTable(M(mdx, 'attr')),
		strToContents(_('References'), bk_txt),
		sourceSection()),
		true /*collapsible*/, true /*is_tabbeb*/);

	html += printChangeTime(M(mdx, 'change_time'));
	return(html);
}


function mediaButtonPageClick(page_delta, page)
{
	var imgI = Dwr.search.ImgList.indexOf(Dwr.search.Mdx);
	if (typeof(page) === 'undefined') page = imgI;
	var i = page + page_delta;
	i = (i + Dwr.search.ImgList.length) % Dwr.search.ImgList.length;
	window.location.href = mediaHref(Dwr.search.ImgList[i]);
	return(false);
}

function mediaButtonMaxClick()
{
	window.location.href = M(Dwr.search.Mdx, 'path');
	return(false);
}

function printMediaMap(mdx)
{
	var html = '';
	var j, k;
//	html += '<ul id="imgmap">';
	html += printMediaRefArea(M(mdx, 'bki'), indiHref, function(ref) {return I(ref, 'name')});
	if (DwrConf.inc_families_pages)
		html += printMediaRefArea(M(mdx, 'bkf'), famHref, function(ref) {return F(ref, 'name')});
	if (DwrConf.inc_sources)
		html += printMediaRefArea(M(mdx, 'bks'), sourceHref, sourName);
	if (DwrConf.inc_places_pages)
		html += printMediaRefArea(M(mdx, 'bkp'), placeHref, function(ref) {return P(ref, 'name')});
//	html += '</ul>';
	return(html);
}

function printMediaRefArea(bk_table, fref, fname)
{
	var html = '';
	for (var j = 0; j < bk_table.length; j++)
	{
		var ref = bk_table[j];
		var idx = ref.bk_idx;
		var rect = [];
		for (var k = 0; k < 4; k++)
		{
			rect[k] = parseFloat(ref.rect[k]);
		}
		if (!isNaN(rect[0]) && rect.join(',') != '0,0,100,100')
		{
			html += '<a href="' + fref(idx) + '"';
			html += ' title="' + fname(idx) + '" class="dwr-imgmap" style="';
			html += 'left: ' + rect[0] + '%;';
			html += 'top: ' + rect[1] + '%;';
			html += 'width: ' + (rect[2] - rect[0]) + '%;';
			html += 'height: ' + (rect[3] - rect[1]) + '%;">';
			html += '</a>';
		}
	}
	return(html);
}


//=================================================================
//========================================================== Source
//=================================================================

function printSource(sdx)
{
	PreloadScripts(NameFieldScripts('S', sdx, ['gid', 'repo', 'attr', 'media', 'notes', 'bkc', 'change_time']), true);
	var html = '';
	if (S(sdx, 'title') != '') html += '<h2 class="page-header">' + S(sdx, 'title') + gidBadge(S(sdx, 'gid')) + '</h2>';
	if (S(sdx, 'text') != '') html += S(sdx, 'text');

	// Repositories for this source
	var bk_txt = printBackRefs(BKREF_TYPE_REPOREF, [], [], [], [], [], S(sdx, 'repo'), []);

	html += PrintTitle('S' + sdx, 3, [].concat(
		attrsTable(S(sdx, 'attr')),
		mediaSection(S(sdx, 'media')),
		noteSection(S(sdx, 'notes')),
		strToContents(_('Repositories'), bk_txt),
		[{
			title: _('Citations'),
			text: printSourceCitations(sdx)
		}]),
		true /*collapsible*/, true /*is_tabbeb*/);
	html += printChangeTime(S(sdx, 'change_time'));
	return(html);
}

function printSourceCitations(sdx)
{
	var html = '';
	if (S(sdx, 'bkc').length > 0)
	{
		html += '<ul class="dwr-citations">';
		var j;
		for (var j = 0; j < S(sdx, 'bkc').length; j++)
		{
			var cdx = S(sdx, 'bkc')[j];
			PreloadScripts(NameFieldScripts('C', cdx, ['text', 'notes', 'media', 'bki', 'bkf', 'bkm', 'bkp', 'bkr', 'bke']), true);
			// html += '<li>' + _('Citation') + ': ';
			html += '<li>';
			if (C(cdx, 'text') != '') html += NoteText(C(cdx, 'text'), '<p>');
			if (C(cdx, 'notes').length > 0) html += '<p><b>' + _('Notes') + ':</b></p>' + NotesString(C(cdx, 'notes'), '<p>');
			if (C(cdx, 'media').length > 0) html += '<p>' + _('Media') + ': ' + mediaLinks(C(cdx, 'media')) + '</p>';
			// Back references
			html += printBackRefs(BKREF_TYPE_INDEX, C(cdx, 'bki'), C(cdx, 'bkf'), [], C(cdx, 'bkm'), C(cdx, 'bkp'), C(cdx, 'bkr'), C(cdx, 'bke'));
			html += '</li>';
		}
		html += '</ul>';
	}
	else
	{
		html += '<p>' + _('None') + '</p>';
	}
	return(html);
}


//=================================================================
//========================================================== Places
//=================================================================

function placeNames(pnames)
{
	if (pnames.length == 0) return('');
	var names = []
	for (var j = 0; j < pnames.length; j++)
	{
		var txt = pnames[j].name;
		if (pnames[j].date != '') txt += ' (' + pnames[j].date + ')';
		names.push(txt);
	}
	return(names.join(', '));
}

function placeHierarchy(pdx)
{
	var enc = placeHierarchySub(P(pdx, 'enclosed_by'), [pdx])
	var thisLevel = '<button type="button" class="btn btn-default btn-arrow-right-right"';
	thisLevel += ' style="z-index:' + (100) + ';"';
	thisLevel += ' disabled>' + placeNames(P(pdx, 'names')) + '</button>';
	var txt = '';
	for (var k = 0; k < enc.length; k++)
	{
		if (enc.length > 1) txt += '<p>';
		txt += thisLevel + ' ' + enc[k];
	}
	return txt;
}

function placeHierarchySub(enclosed_by, visited)
{
	if (enclosed_by.length == 0) return [];
	var enc = [];
	for (var j = 0; j < enclosed_by.length; j++)
	{
		var pdx = enclosed_by[j].pdx;
		if ($.inArray(pdx, visited) != -1) continue;
		var enc2 = placeHierarchySub(P(pdx, 'enclosed_by'), $.merge($.merge([], visited), [pdx]));
		
		var thisLevel = '<button type="button" class="btn btn-primary btn-arrow-left-right ';
		if (enc2.length > 0) thisLevel += ' btn-arrow-right-right';
		thisLevel += ' style="z-index:' + (100 - visited.length) + ';"';
		thisLevel += ' onclick="location.href=\'' + placeHref(pdx) + '\';"';
		thisLevel += '>' + placeNames(P(pdx, 'names'));
		if (enclosed_by[j].date != '') txt += ' (' + enclosed_by[j].date + ')';
		thisLevel += '</button>';
		
		for (var k = 0; k < enc2.length; k++)
		{
			enc.push(thisLevel + ' ' + enc2[k]);
		}
		if (enc2.length == 0)
		{
			enc.push(thisLevel);
		}
	}
	return enc;
}

function printPlace(pdx)
{
	PreloadScripts(NameFieldScripts('P', pdx, ['name', 'locations', 'gid', 'cita', 'names', 'type', 'code', 'coords', 'enclosed_by', 'bki', 'bkf', 'bkp', 'bke', 'urls', 'media', 'notes', 'change_time']), true);
	var html = '';
	var name = P(pdx, 'name');
	if (name == '') name = locationString(P(pdx, 'locations'));
	html += '<h2 class="page-header">' + name + gidBadge(P(pdx, 'gid')) + citaLinks(P(pdx, 'cita')) + '</h2>';
	if (P(pdx, 'names').length > 0)
	{
		html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Name') + ':</span> ';
		html += placeNames(P(pdx, 'names'));
		html += '</p>';
	}
	if (P(pdx, 'type') != '') html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Type') + ':</span> ' + P(pdx, 'type') + '</p>';
	if (P(pdx, 'code') != '') html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Code') + ':</span> ' + P(pdx, 'code') + '</p>';
	if (P(pdx, 'coords')[0] != '' && P(pdx, 'coords')[1] != '')
		html +=
			'<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Latitude') + ':</span> ' + P(pdx, 'coords')[0] + '</p>' +
			'<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Longitude') + ':</span> ' + P(pdx, 'coords')[1] + '</p>';
	for (var j = 0; j < P(pdx, 'locations').length; j++)
	{
		html += '<p class="dwr-attr-title">';
		if (j == 0) html += _('Location');
		else html += _('Alternate Name') + ' ' + j;
		html += ': </p><ul>';
		var loc = P(pdx, 'locations')[j];
		for (var k = 0; k < loc.length; k ++)
		{
			html += '<li class="dwr-attr-value"><span class="dwr-attr-title">' + loc.type + ':</span> ' + loc.name + '</li>';
		}
		html += '</ul>';
	}
	if (P(pdx, 'enclosed_by').length > 0)
	{
		html += '<p class="dwr-attr-title">' + _('Enclosed By') + ': ';
		html += placeHierarchy(pdx);
	}

	// Add place to the map
	pagePlaces.push({pdx: pdx, idx: -1, fdx: -1, edx: -1});
	
	// Back references
	var bk_place = htmlPlacesIndexTree('', P(pdx, 'bkp'));
	var bk_txt = printBackRefs(BKREF_TYPE_INDEX, P(pdx, 'bki'), P(pdx, 'bkf'), [], [], [], [], P(pdx, 'bke'));

	html += PrintTitle('P' + pdx, 3, [].concat(
		urlsTable(P(pdx, 'urls')),
		mediaSection(P(pdx, 'media')),
		noteSection(P(pdx, 'notes')),
		printMap(Dwr.search.MapPlace),
		sourceSection(),
		strToContents(_('Places'), bk_place),
		strToContents(_('References'), bk_txt)),
		true /*collapsible*/, true /*is_tabbeb*/);

	html += printChangeTime(P(pdx, 'change_time'));
	return(html);
}


//=================================================================
//==================================================== Repositories
//=================================================================

function printRepo(rdx)
{
	PreloadScripts(NameFieldScripts('R', rdx, ['name', 'gid', 'type', 'bks', 'addrs', 'urls', 'notes', 'change_time']), true);
	var html = '';
	html += '<h2 class="page-header">' + R(rdx, 'name') + gidBadge(R(rdx, 'gid')) + '</h2>';
	html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Type') + ': </span>'
	html += R(rdx, 'type') + '</p>';

	// Back references
	var bk_txt = printBackRefs(BKREF_TYPE_REPO, [], [], R(rdx, 'bks'), [], [], [], []);
	if (bk_txt == '') bk_txt = _('None');

	html += PrintTitle('R' + rdx, 3, [].concat(
		addrsTable(R(rdx, 'addrs')),
		urlsTable(R(rdx, 'urls')),
		noteSection(R(rdx, 'notes')),
		strToContents(_('References'), bk_txt),
		sourceSection()),
		true /*collapsible*/, true /*is_tabbeb*/);
	html += printChangeTime(R(rdx, 'change_time'));
	return(html);
}


//=================================================================
//==================================================== Events
//=================================================================

function printEvent(edx)
{
	PreloadScripts(NameFieldScripts('E', edx, ['type', 'gid', 'descr', 'name', 'notes', 'date', 'place', 'change_time', 'bki', 'bkf']), true);
	var html = '';
	html += '<h2 class="page-header">' + E(edx, 'name') + gidBadge(E(edx, 'gid')) + '</h2>';
	html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Type') + ': </span>';
	html += (E(edx, 'type') || empty(_('Without type'))) + '</p>';
	if (E(edx, 'descr'))
	{
		html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Description') + ': </span>';
		html += E(edx, 'descr') + '</p>';
	}
	if (E(edx, 'date'))
	{
		html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Date') + ': </span>';
		html += E(edx, 'date') + '</p>';
	}
	if (E(edx, 'place') >= 0)
	{
		html += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Place') + ': </span>';
		html += placeLink(E(edx, 'place')) + '</p>';
	}
	
	// Back references
	var bk_txt = printBackRefs(BKREF_TYPE_EVENT, E(edx, 'bki'), E(edx, 'bkf'), [], [], [], [], []);

	html += PrintTitle('E' + edx, 3, [].concat(
		strToContents(_('Participants'), bk_txt),
		noteSection(E(edx, 'notes')),
		sourceSection()),
		true /*collapsible*/, true /*is_tabbeb*/);
		
	html += printChangeTime(E(edx, 'change_time'));
	return(html);
}


//=================================================================
//==================================================== Notes
//=================================================================

function printNote(tdx)
{
	PreloadScripts(NameFieldScripts('T', tdx, ['type', 'gid', 'text', 'bki', 'bkf', 'bkm', 'bks', 'bkr', 'bkp', 'bke']), true);
	var html = '';
	html += '<h2 class="page-header">' + T(tdx, 'type') + gidBadge(T(tdx, 'gid')) + '</h2>';
	
	// Back references
	var bk_txt = printBackRefs(BKREF_TYPE_INDEX, T(tdx, 'bki'), T(tdx, 'bkf'), T(tdx, 'bks'), T(tdx, 'bkm'), T(tdx, 'bkp'), T(tdx, 'bkr'), T(tdx, 'bke'));

	html += PrintTitle('T' + tdx, 3, [].concat(
		[{
			title: _('Text'),
			text: T(tdx, 'text')
		}],
		strToContents(_('References'), bk_txt)),
		true /*collapsible*/, true /*is_tabbeb*/);
		
	html += printChangeTime(T(tdx, 'change_time'));
	return(html);
}


//=========================================================================================
//=========================================================================================
//=========================================================================================
//=================================================================================== Index
//=========================================================================================
//=========================================================================================
//=========================================================================================

// Fancy features are disabled above the limits below
var TABLE_OPTIMIZATION_LIMIT = 3000;
var LIST_OPTIMIZATION_LIMIT = 1000;
var TREE_OPTIMIZATION_LIMIT = 1000;
var MAP_OPTIMIZATION_LIMIT = 1000;
var ENABLE_LIST_SECTIONS = 50;

function PrintIndex(id, header, type, fTable, fList, data)
{
	if (preloadMode)
	{
		if (type) fTable(data);
		else fList(data);
		return '';
	}

	// Get all data if not specified
	if (typeof(data) !== 'undefined')
	{
		header = '';
	}
	else
	{
		data = new Array(DwrConf.db_sizes[id]);
		for (var x = 0; x < DwrConf.db_sizes[id]; x++) data[x] = x;
	}

	if (type) return fTable(header, data);
	return fList(header, data);
}

function PrintIndexTable(id, header, data, defaultsort, columns)
// id: table ID
// header: Page header
// data: Array of data to be indexed, it is a 2D array
// defaultsort: Default ordering (sorting), corresponding to the Datatables 'order' option
// columns: Array of columns descriptions:
//    title: Column title
//    ftext, fhref, fsort: Functions to build and format data.
//    These functions have 2 parameters: (row, column) in the  2D array <data>
//    Each function could be disabled by providing false instead of function.
//    ftext: Formated text
//    fhref: Hyperlink
//    fsort: Sortable value
{
	// var time = Date.now();
	var j, k, l;

	// Compute data
	// (optimization: copy data in another array in order to call functions ftext, fsort, fhref only once)
	// Also check if a column is empty
	var data_copy = Array(data.length);
	var nb_cols = columns.length;
	var col_empty = []; // is the column emtpy ?
	var col_num = []; // does the colmun contain only numbers ?
	for (j = 0; j < nb_cols; j++)
	{
		col_empty.push(true);
		col_num.push(true);
	}
	for (j = 0; j < data.length; j++)
	{
		var line = [];
		for (k = 0; k < nb_cols; k++)
		{
			var text = columns[k].ftext(j, k);
			if (typeof(text) === 'undefined') text = '';
			text = text.toString();
			var text_sort = text.replace(/<[^>]*>/g, '');
			// var text_filt = text_sort + ' ' + unorm.nfkc(text_sort);  // nfkc removed for optimization (too much time-consuming)
			var text_filt = text_sort;
			if (text != '')
			{
				col_empty[k] = false;
				if (columns[k].fhref)
				{
					var hr = columns[k].fhref(j);
					if (hr != '') text = '<a class="dwr-index" href="' + hr + '">' + text + '</a>';
				}
			}
			if (columns[k].fsort)
			{
				text_sort = columns[k].fsort(j, k);
				if (typeof(text_sort) === 'undefined') text_sort = '';
				if (typeof(text_sort) != 'number') text_sort = text_sort.toString();
			}
			if (typeof(text_sort) != 'number') col_num[k] = false;
			line.push({
				'text': text,
				'sort': text_sort,
				'filter': text_filt
			});
		}
		data_copy[j] = line;
	}

	// Remove empty columns
	var nb_cols_suppr = 0;
	for (k = 0; k < nb_cols; k++)
	{
		if (col_empty[k])
		{
			nb_cols_suppr += 1;
			// Remove useless columns in defaultsort
			var newds = [];
			for (l = 0; l < defaultsort.length; l += 1)
			{
				if (defaultsort[l][0] < k)
				{
					newds.push(defaultsort[l]);
				}
				else if (defaultsort[l][0] > k)
				{
					defaultsort[l][0] -= 1;
					newds.push(defaultsort[l]);
				}
			}
			defaultsort = newds;
		}
		else if (nb_cols_suppr > 0)
		{
			columns[k - nb_cols_suppr] = columns[k];
			col_num[k - nb_cols_suppr] = col_num[k];
			for (j = 0; j < data_copy.length; j++)
			{
				data_copy[j][k - nb_cols_suppr] = data_copy[j][k];
			}
		}
	}
	nb_cols -= nb_cols_suppr;

	if (data_copy.length > TABLE_OPTIMIZATION_LIMIT) console.log('Table has too many rows (' + data_copy.length + '). Disabling fancy features.');

	// Prepare columns definition for DataTables plugin
	var colDefs = []
	for (k = 0; k < nb_cols; k += 1)
	{
		colDefs.push({
			'data': {
				'_': k + '.text',
				'display': k + '.text',
				'filter': k + '.filter',
				'sort': k + '.sort',
			},
			// 'width': '200px',
			'type': (col_num[k] ? 'num' : 'string'),
			'orderable': (columns[k].fsort !== false)// && (data_copy.length <= TABLE_OPTIMIZATION_LIMIT)
		});
	}

	// Print title
	var html = '';
	if (header != '')
	{
		html += '<h2 class="page-header">' + header + '</h2>';
		data = new Array(DwrConf.db_sizes[id]);
		for (var x = 0; x < DwrConf.db_sizes[id]; x++) data[x] = x;
	}

	// Print table
	if (data_copy.length == 0)
	{
		html += '<p>' + _('None') + '</p>';
		return(html);
	}
	html += '<table id="dwr-index-' + id + '" class="table table-condensed table-bordered dt-table dt-responsive dwr-table-flat" width="100%">';
	html += '<thead><tr>';
	for (k = 0; k < nb_cols; k++)
	{
		html += '<th class="dwr-index-title">';
		html += columns[k].title;
		html += '</th>';
	}
	html += '</tr></thead>';
	html += '<tbody>';
	html += '</tbody>';
	html += '</table>';

	// Build the DataTable, see http://www.datatables.net/
	(function(){ // This is used to create instances of local variables
		$(document).ready(function() {
			$('#dwr-index-' + id).DataTable({
				'ordering': true, //(data_copy.length <= TABLE_OPTIMIZATION_LIMIT),
				'order': defaultsort,
				'orderClasses': false,
				'info': false,
				'responsive': (data_copy.length <= TABLE_OPTIMIZATION_LIMIT),
				'stateSave': true,
				'iDisplayLength': DwrConf.INDEXES_SIZES[0][DwrConf.entries_shown],
				'aLengthMenu': DwrConf.INDEXES_SIZES,
				'columns': colDefs,
				'data': data_copy,
				'deferRender': (data_copy.length > TABLE_OPTIMIZATION_LIMIT),
				'autoWidth': (data_copy.length <= TABLE_OPTIMIZATION_LIMIT),
				'processing': true,
				'searching': (data_copy.length <= TABLE_OPTIMIZATION_LIMIT),
				'dom':
					'<"row"<"col-xs-12"f>>' +
					'<"row"<"col-xs-12"tr>>' +
					'<"row"<"col-xs-4"l><"col-xs-8"p>>',
				'language': {
					'emptyTable':     _('No data available in table'),
					'info':           _('Showing _START_ to _END_ of _TOTAL_ entries'),
					'infoEmpty':      _('Showing 0 to 0 of 0 entries'),
					'infoFiltered':   _('(filtered from _MAX_ total entries)'),
					'infoPostFix':    '',
					'thousands':      '',
					'lengthMenu':     _('Show _MENU_ entries'),
					'loadingRecords': _('Loading...'),
					'processing':     _('Processing...'),
					'search':         _('Search:'),
					'zeroRecords':    _('No matching records found'),
					'paginate': {
						'first':      '<span class="glyphicon glyphicon-step-backward"></span>',
						'last':       '<span class="glyphicon glyphicon-step-forward"></span>',
						'next':       '<span class="glyphicon glyphicon-chevron-right"></span>',
						'previous':   '<span class="glyphicon glyphicon-chevron-left"></span>'
					},
					'aria': {
						'sortAscending':  _(': activate to sort column ascending'),
						'sortDescending': _(': activate to sort column descending')
					}
				}
			});
		});
		if (data_copy.length <= TABLE_OPTIMIZATION_LIMIT)
			$(window).load(function() {
				$('#dwr-index-' + id).DataTable().columns.adjust().responsive.recalc();
			});
	})();

	return(html);
}

function PrintIndexListTitle(header, data, sortingAttributes, defaultSort)
{
	// Get saved state
	var lsName = window.location.pathname + ' ' + header + ' sorting';
	var saved_sorting_way = sessionStorage.getItem(lsName);
	var sorting_way = defaultSort;
	for (var i = 0; i < sortingAttributes.length; i += 1)
	{
		if (sortingAttributes[i].id == saved_sorting_way) sorting_way = i;
	}

	// Print header and sorting way selector
	var html = '';
	if (header != '')
	{
		if (sortingAttributes.length < 2)
		{
			html += '<h2 class="page-header">' + header + '</h2>';
		}
		else
		{
			html += '<div class="row">';
			html += '<div class="col-xs-12 col-sm-6"><h2 class="page-header">' + header + '</h2></div>';
			html += '<form class="form-horizontal col-xs-12 col-sm-6 dwr-form-sort-by"><div class="form-group">';
			html += '<label class="control-label col-xs-4" for="dwr-input-sort-by">' + _('Sort by:') + '</label>';
			html += '<div class="col-xs-8"><select id="dwr-input-sort-by" class="form-control">';
			for (var i = 0; i < sortingAttributes.length; i += 1)
			{
				html += '<option value="' + sortingAttributes[i].id + '"' + (i == sorting_way ? ' selected' : '') + '>';
				html += sortingAttributes[i].title + '</option>';
			}
			html += '</select></div></div></form></div>';
			$(window).load(function() {
				$('#dwr-input-sort-by').change(function() {
					sessionStorage.setItem(lsName, $(this).val());
					window.location.replace(window.location.href);
					return(false);
				});
			});
		}
	}

	return {
		html: html,
		sorting_way: sorting_way
	};
}

function PrintIndexList(id, header, data, fText, before, after, separator, sortingAttributes, defaultSort)
// id: Data type
// header: Page header
// data: Array of data to be indexed
// fText, fLetter: function taking a <data> row as parameter.
// fText gives the text to print for the row
// separator: separator printed between items
// sortingAttributes: Array describing for each way of sorting the data
//    title: name for the sorting way
//    id: unique identifier for the sorting way
//    fSort: sorting function
//    fLetter: Section header for the row (None if no sections)
{
	var lts = PrintIndexListTitle(header, data, sortingAttributes, defaultSort);
	var html = lts.html;
	var sorting_way = lts.sorting_way;

	// Sort data
	if (sortingAttributes.length > 0) data.sort(sortingAttributes[sorting_way].fSort);

	// Split data into several sections if fLetter is provided
	var titles = [];
	var texts = [];
	if (sortingAttributes.length > 0 && sortingAttributes[sorting_way].fLetter)
	{
		// The data can be grouped by sections
		// Build the titles and texts
		var titles = [];
		var texts = [];
		for (var x = 0; x < data.length; x++)
		{
			var letter = sortingAttributes[sorting_way].fLetter(data[x]);
			if ($.inArray(letter, titles) == -1)
			{
				// New letter section
				titles.push(letter);
				texts[letter] = [];
			}
			texts[letter].push(fText(data[x]));
		}
	}
	if (titles.length > 1 && data.length > ENABLE_LIST_SECTIONS)
	{
		// Print list into several sections, each with a letter as header, if there are more than 1 section
		var sections = []
		for (i = 0; i < titles.length; i++)
		{
			sections.push({
				title: _(titles[i] || '&nbsp;'),
				text: texts[titles[i]].join(separator)
			});
		}
		html += PrintTitle(id + 'index', 3, sections, true /*collapsible*/, true /*is_tabbeb*/, true /*collapsed*/);
	}
	else
	{
		// The data is not split into sections (or less than 2 sections)
		for (x = 0; x < data.length; x++)
		{
			if (x > 0) html += separator;
			html += fText(data[x]);
		}
		// Add extra space after list index when not in a panel
		if (header) html += '<p>&nbsp;</p>';
	}

	// When no data
	if (data.length == 0)
	{
		html += '<p>' + _('None') + '</p>';
	}

	return(html);
}


//=========================================================================================
//=========================================================================== Persons Index
//=========================================================================================

function htmlPersonsIndex(data)
{
	return PrintIndex('I', _('Persons Index'), Dwr.search.IndexTypeI, htmlPersonsIndexTable, htmlPersonsIndexList, data);
}

function htmlPersonsIndexTable(header, data)
{
	var scripts = [
		['I', 'name'],
		['I', 'gender']
	];
	if (Dwr.search.IndexShowDates) scripts.push(
		['I', 'birth_date'], ['I', 'birth_sdn'],
		['I', 'death_date'], ['I', 'death_sdn']);
	if (Dwr.search.IndexShowPartner) scripts.push(['I', 'fams'], ['F', 'spou']);
	if (Dwr.search.IndexShowParents) scripts.push(['I', 'famc'], ['F', 'spou']);
	if (!Dwr.search.HideGid) scripts.push(['I', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Name'),
		ftext: function(x, col) {return I_name[data[x]] || empty(_('Without name'))},
		fhref: function(x) {return indiHrefOptimized(data[x])},
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Gender'),
		ftext: function(x, col) {return _(I_gender[data[x]])}
	}];
	if (Dwr.search.IndexShowDates) columns.push({
		title: _('Birth'),
		ftext: function(x, col) {return I_birth_date[data[x]]},
		fsort: function(x, col) {return I_birth_sdn[data[x]]}
	});
	if (Dwr.search.IndexShowDates) columns.push({
		title: _('Death'),
		ftext: function(x, col) {return I_death_date[data[x]]},
		fsort: function(x, col) {return I_death_sdn[data[x]]}
	});
	if (Dwr.search.IndexShowPartner) columns.push({
		title: _('Spouses'),
		ftext: function(x, col) {
			var txt = '';
			var sep = '';
			for (var x_fams = 0; x_fams < I_fams[data[x]].length; x_fams++)
			{
				var spouses = F_spou[I_fams[data[x]][x_fams]];
				for (var x_spou = 0; x_spou < spouses.length; x_spou++)
				{
					if (spouses[x_spou] !== data[x])
					{
						txt += sep + '<a class="dwr-index" href="' + indiHrefOptimized(spouses[x_spou]) + '">';
						txt += I_name[spouses[x_spou]] + '</a>';
						sep = '<br>';
					}
				}
			}
			return(txt);
		},
		fsort: false
	});
	if (Dwr.search.IndexShowParents) columns.push({
		title: _('Parents'),
		ftext: function(x, col) {
			var txt = '';
			var sep = '';
			for (var x_famc = 0; x_famc < I_famc[data[x]].length; x_famc++)
			{
				var parents = F_spou[I_famc[data[x]][x_famc].index];
				for (var x_spou = 0; x_spou < parents.length; x_spou++)
				{
					if (parents[x_spou] !== data[x])
					{
						txt += sep + '<a class="dwr-index" href="' + indiHrefOptimized(parents[x_spou]) + '">';
						txt += I_name[parents[x_spou]] + '</a>';
						sep = '<br>';
					}
				}
			}
			return(txt);
		},
		fsort: false
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return I_gid[data[x]]},
		fhref: function(x) {return indiHrefOptimized(data[x])}
	});
	return PrintIndexTable('I', header, data, [[(Dwr.search.HideGid ? 0 : 1), 'asc']], columns);
}


function htmlPersonsIndexList(header, data)
{
	var scripts = [
		['I', 'name'],
		['I', 'letter'],
		['I', 'birth_date'],
		['I', 'death_date'],
		['I', 'birth_sdn'],
		['I', 'death_sdn']
	];
	if (!Dwr.search.HideGid) scripts.push(['I', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	var fText = function(idx)
	{
		var txt = '<a href="' + indiHrefOptimized(idx) + '">';
		txt += I_name[idx] || empty(_('Without name'));
		if (!Dwr.search.HideGid) txt += gidBadge(I_gid[idx]);
		txt += indiDates(I_birth_date[idx], I_death_date[idx]);
		txt += '</a>';
		return txt;
	};
	var sortingAttributes = [
		{
			title: _('Name'),
			id: 'I.name',
			fSort: function(a, b) {return(a - b)},
			fLetter: function(idx) {return I_letter[idx]}
		},
		{
			title: _('Birth date'),
			id: 'I.birth_date',
			fSort: function(a, b) {return(I_birth_sdn[b] - I_birth_sdn[a])},
			fLetter: false
		},
		{
			title: _('Death date'),
			id: 'I.death_date',
			fSort: function(a, b) {return(I_death_sdn[b] - I_death_sdn[a])},
			fLetter: false
		}
	];
	if (!Dwr.search.HideGid) sortingAttributes.push({
		title: _('ID'),
		id: 'I.gid',
		fSort: function(a, b) {return cmp(I_gid[a], I_gid[b])},
		fLetter: false
	});
	return PrintIndexList('I', header, data, fText, '', '', '<br>', sortingAttributes, 0);
}


//=========================================================================================
//========================================================================== Families Index
//=========================================================================================

function printIndexSpouseText(fdx, col)
{
	var gender = (col == (Dwr.search.HideGid ? 0 : 1))? 'M' : 'F';
	for (var j = 0; j < F_spou[fdx].length; j++)
	{
		if (I_gender[F_spou[fdx][j]] == gender)
			return I_name[F_spou[fdx][j]] || empty(_('Without name'));
	}
	return('');
}
function printIndexSpouseIdx(fdx, col)
{
	var gender = (col == (Dwr.search.HideGid ? 0 : 1))? 'M' : 'F';
	for (var j = 0; j < F_spou[fdx].length; j++)
		if (I_gender[F_spou[fdx][j]] == gender)
			return(F_spou[fdx][j]);
	return(-1);
}

function htmlFamiliesIndex(data)
{
	return PrintIndex('F', _('Families Index'), Dwr.search.IndexTypeF, htmlFamiliesIndexTable, htmlFamiliesIndexList, data);
}

function htmlFamiliesIndexTable(header, data)
{
	var scripts = [
		['I', 'name'],
		['I', 'gender'],
		['F', 'spou']
	];
	if (Dwr.search.IndexShowDates) scripts.push(['F', 'marr_date'], ['F', 'marr_sdn']);
	if (!Dwr.search.HideGid) scripts.push(['F', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Father'),
		ftext: function(x, col) {return printIndexSpouseText(data[x], col)},
		fhref: function(x) {return famHrefOptimized(data[x])},
		fsort: function(x, col) {return printIndexSpouseIdx(data[x], col)}
	}, {
		title: _('Mother'),
		ftext: function(x, col) {return printIndexSpouseText(data[x], col)},
		fhref: function(x) {return famHrefOptimized(data[x])},
		fsort: function(x, col) {return printIndexSpouseIdx(data[x], col)}
	}];
	if (Dwr.search.IndexShowDates) columns.push({
		title: _('Marriage'),
		ftext: function(x, col) {return F_marr_date[data[x]]},
		fsort: function(x, col) {return F_marr_sdn[data[x]]}
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return F_gid[data[x]]},
		fhref: function(x) {return famHrefOptimized(data[x])}
	});
	return PrintIndexTable('F', header, data, [[(Dwr.search.HideGid ? 0 : 1), 'asc']], columns);
}


function htmlFamiliesIndexList(header, data)
{
	var scripts = [
		['I', 'name'],
		['I', 'letter'],
		['F', 'name'],
		['F', 'spou'],
		['F', 'marr_date'],
		['F', 'marr_sdn']
	];
	if (!Dwr.search.HideGid) scripts.push(['I', 'gid'], ['F', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// build data for each spouse of each family
	var data2 = [];
	for (var x = 0; x < data.length; x += 1)
	{
		var fdx = data[x];
		for (var y = 0; y < F_spou[fdx].length; y += 1)
		{
			data2.push([fdx, F_spou[fdx][y]]);
		}
		if (F_spou[fdx].length == 0)
		{
			data2.push([fdx,-1]);
		}
	}

	var fText = function(d2)
	{
		var fdx = d2[0];
		var idx = d2[1];
		var txt = '';
		if (idx >= 0)
		{
			txt += '<a href="' + indiHrefOptimized(idx) + '">';
			txt += I_name[idx];
			if (!Dwr.search.HideGid) txt += gidBadge(I_gid[idx]);
			txt += '</a> : ';
		}
		txt += '<a href="' + famHrefOptimized(fdx) + '">';
		txt += F_name[fdx];
		if (!Dwr.search.HideGid) txt += gidBadge(F_gid[fdx]);
		txt += '</a>';
		txt += famDates(F_marr_date[fdx]);
		return txt;
	};
	var sortingAttributes = [
		{
			title: _('Name'),
			id: 'F.spouse.name',
			fSort: function(a, b) {return(a[1] - b[1])},
			fLetter: function(d2) {return (d2[1] >= 0) ? I_letter[d2[1]] : ''},
		},
		{
			title: _('Marriage date'),
			id: 'F.marr_date',
			fSort: function(a, b) {return(F_marr_sdn[b[0]] - F_marr_sdn[a[0]])},
			fLetter: false
		}
	];
	if (!Dwr.search.HideGid) sortingAttributes.push({
		title: _('ID'),
		id: 'F.gid',
		fSort: function(a, b) {return cmp(F_gid[a[0]], F_gid[b[0]])},
		fLetter: false
	});
	return PrintIndexList('F', header, data2, fText, '', '', '<br>', sortingAttributes, 0);
}


//=========================================================================================
//==================================================================== Index back reference
//=========================================================================================

function indexBkrefName(type, referencedType, referencedDx, bk_field, objects, name_prop, ref)
{
	// Returns the nameof a back reference from objects of type <objects> listed in the field <bk_field> of record <referencedDx> of table <referencedType>
	// <type> is the type of the back reference link
	// <ref> is a function that gets the URL for the back reference
	var bk_table;
	if (type == BKREF_TYPE_SOURCE)
	{
		// Extract the list of object referencing the citations referencing the source
		var bk_table = [];
		for (var x_cita = 0; x_cita < S_bkc[referencedDx].length; x_cita++)
		{
			var cdx = S_bkc[referencedDx][x_cita];
			for (var x_bk = 0; x_bk < C(cdx, bk_field).length; x_bk++) bk_table.push(C(cdx, bk_field)[x_bk]);
		}
	}
	else
	{
		bk_table = window[referencedType + '_' + bk_field][referencedDx];
	}
	var txt = '';
	var sep = '';
	var already_found = [];
	var names = window[objects + '_' + name_prop];
	for (var x_bk = 0; x_bk < bk_table.length; x_bk++)
	{
		var x_object;
		if (type == BKREF_TYPE_INDEX) x_object = bk_table[x_bk];
		if (type == BKREF_TYPE_MEDIA) x_object = bk_table[x_bk].bk_idx;
		if (type == BKREF_TYPE_SOURCE) x_object = bk_table[x_bk];
		if (type == BKREF_TYPE_REPO) x_object = bk_table[x_bk].s_idx;
		if (type == BKREF_TYPE_EVENT) x_object = bk_table[x_bk].bk_idx;
		if ($.inArray(x_object, already_found) == -1)
		{
			already_found.push(x_object);
			var name = names[x_object];
			if (name != '')
			{
				txt += sep;
				sep = '<br>';
				txt += '<a class="dwr-index" href="' + ref(x_object) + '">' + name + '</a>';
			}
		}
	}
	return(txt);
}


//=========================================================================================
//============================================================================= Media Index
//=========================================================================================

function htmlMediaIndex(data)
{
	return PrintIndex('M', _('Media Index'), true, htmlMediaIndexTable, null, data);
}

function htmlMediaIndexTable(header, data)
{
	var scripts = [
		['M', 'thumb'],
		['M', 'title'],
		['M', 'date'],
		['M', 'date_sdn']
	];
	if (Dwr.search.IndexShowPath) scripts.push(['M', 'gramps_path']);
	if (Dwr.search.IndexShowBkrefType) scripts.push(
		['M', 'bki'],
		['M', 'bkf'],
		['M', 'bks'],
		['M', 'bkp'],
		['I', 'name'],
		['F', 'name'],
		['S', 'title'],
		['P', 'name']
	);
	if (!Dwr.search.HideGid) scripts.push(['M', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: '',
		ftext: function(x, col) {return(
			'<a class="thumbnail" href="' + mediaHrefOptimized(data[x]) + '">' +
			'<img src="' + M_thumb[data[x]] + '"></a>'
		)},
		fsort: false
	}, {
		title: _('Title'),
		ftext: function(x, col) {return M_title[data[x]]},
		fhref: function(x) {return mediaHrefOptimized(data[x])},
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Date'),
		ftext: function(x, col) {return M_date[data[x]]},
		fsort: function(x, col) {return M_date_sdn[data[x]]}
	}];
	if (Dwr.search.IndexShowPath) columns.push({
		title: _('Path'),
		ftext: function(x, col) {return M_gramps_path[data[x]]},
		fhref: function(x) {return((M_title[data[x]] == '') ? mediaHrefOptimized(data[x]) : '')}
	});
	if (Dwr.search.IndexShowBkrefType) columns.push({
		title: _('Used for person'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_MEDIA, 'M', data[x], 'bki', 'I', 'name', indiHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_families_pages) columns.push({
		title: _('Used for family'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_MEDIA, 'M', data[x], 'bkf', 'F', 'name', famHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_sources) columns.push({
		title: _('Used for source'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_MEDIA, 'M', data[x], 'bks', 'S', 'title', sourceHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_places_pages) columns.push({
		title: _('Used for place'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_MEDIA, 'M', data[x], 'bkp', 'P', 'name', placeHrefOptimized)},
		fsort: false
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return M_gid[data[x]]},
		fhref: function(x) {return mediaHrefOptimized(data[x])}
	});
	return PrintIndexTable('M', header, data, [[(Dwr.search.HideGid ? 1 : 2), 'asc']], columns);
}


//=========================================================================================
//=========================================================================== Sources Index
//=========================================================================================

function htmlSourcesIndex(data)
{
	return PrintIndex('S', _('Sources Index'), Dwr.search.IndexTypeS, htmlSourcesIndexTable, htmlSourcesIndexList, data);
}

function htmlSourcesIndexTable(header, data)
{
	var scripts = [
		['S', 'title'],
		['S', 'author'],
		['S', 'abbrev'],
		['S', 'publ']
	];
	if (Dwr.search.IndexShowBkrefType) scripts.push(
		['S', 'bkc'],
		['C', 'bki'],
		['C', 'bkf'],
		['C', 'bkm'],
		['C', 'bkp'],
		['I', 'name'],
		['F', 'name'],
		['M', 'title'],
		['P', 'name']
	);
	if (!Dwr.search.HideGid) scripts.push(['S', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Title'),
		ftext: function(x, col) {return S_title[data[x]] || empty(_('Without title'))},
		fhref: function(x) {return sourceHrefOptimized(data[x])},
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Author'),
		ftext: function(x, col) {return S_author[data[x]]},
		fhref: function(x) {return sourceHrefOptimized(data[x])}
	}, {
		title: _('Abbreviation'),
		ftext: function(x, col) {return S_abbrev[data[x]]},
		fhref: function(x) {return sourceHrefOptimized(data[x])}
	}, {
		title: _('Publication information'),
		ftext: function(x, col) {return S_publ[data[x]]},
		fhref: function(x) {return sourceHrefOptimized(data[x])}
	}];
	if (Dwr.search.IndexShowBkrefType) columns.push({
		title: _('Used for person'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_SOURCE, 'S', data[x], 'bki', 'I', 'name', indiHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_families_pages) columns.push({
		title: _('Used for family'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_SOURCE, 'S', data[x], 'bkf', 'F', 'name', famHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_gallery) columns.push({
		title: _('Used for media'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_SOURCE, 'S', data[x], 'bkm', 'M', 'title', mediaHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_places_pages) columns.push({
		title: _('Used for place'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_SOURCE, 'S', data[x], 'bkp', 'P', 'name', placeHrefOptimized)},
		fsort: false
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return S_gid[data[x]]},
		fhref: function(x) {return sourceHrefOptimized(data[x])}
	});
	return PrintIndexTable('S', header, data, [[(Dwr.search.HideGid ? 0 : 1), 'asc']], columns);
}


function htmlSourcesIndexList(header, data)
{
	var scripts = [
		['S', 'title'],
		['S', 'letter'],
		['S', 'author']
	];
	if (!Dwr.search.HideGid) scripts.push(['S', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	var fText = function(sdx)
	{
		var txt = '<a href="' + sourceHrefOptimized(sdx) + '">';
		txt += S_title[sdx] || empty(_('Without title'));
		if (!Dwr.search.HideGid) txt += gidBadge(S_gid[sdx]);
		if (S_author[sdx]) txt += ' (' + S_author[sdx] + ')';
		txt += '</a>';
		return txt;
	};
	var sortingAttributes = [
		{
			title: _('Title'),
			id: 'S.title',
			fSort: function(a, b) {return cmp(S_title[a], S_title[b])},
			fLetter: function(sdx) {return S_letter[sdx]}
		},
		{
			title: _('Author'),
			id: 'S.author',
			fSort: function(a, b) {return cmp(S_author[a], S_author[b])},
			fLetter: false
		}
	];
	if (!Dwr.search.HideGid) sortingAttributes.push({
		title: _('ID'),
		id: 'S.gid',
		fSort: function(a, b) {return cmp(S_gid[a], S_gid[b])},
		fLetter: false
	});
	return PrintIndexList('S', header, data, fText, '', '', '<br>', sortingAttributes, 0);
}


//=========================================================================================
//============================================================================ Places Index
//=========================================================================================

function htmlPlacesIndex(data)
{
	return PrintIndex('P', _('Places Index'), Dwr.search.IndexTypeP, htmlPlacesIndexTable, htmlPlacesIndexTree, data);
}


function printPlacesIndexColText(data, x, field)
{
	var pdx = data[x];
	if (P_locations[pdx].length == 0) return('');
	if (typeof(P_locations[pdx][0][field]) === 'undefined') return('');
	return(P_locations[pdx][0][field]);
}

function printPlacesIndexColCoord(pdx, col)
{
	var c = P_coords[pdx][col - 9];
	if (c == '') return('');
	c = Number(c);
	var txt = '000' + Math.abs(c).toFixed(4);
	txt = txt.substr(txt.length - 8);
	txt = ((c < 0)? '-' : '+') + txt;
	return(txt);
}

function htmlPlacesIndexTable(header, data)
{
	var scripts = [
		['P', 'name'],
		['P', 'coords'],
		['P', 'type'],
		['P', 'code'],
		['P', 'locations']
	];
	if (Dwr.search.IndexShowBkrefType) scripts.push(
		['P', 'enclosed_by'],
		['P', 'bki'],
		['P', 'bkf'],
		['I', 'name'],
		['F', 'name']
	);
	if (!Dwr.search.HideGid) scripts.push(['P', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Name'),
		ftext: function(x, col) {return P_name[data[x]] || empty(_('Without name'))},
		fhref: function(x) {return placeHrefOptimized(data[x])},
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Latitude'),
		ftext: function(x, col) {
			if (P_coords[data[x]][0] == '') return('');
			return(Number(P_coords[data[x]][0]));
		}
	}, {
		title: _('Longitude'),
		ftext: function(x, col) {
			if (P_coords[data[x]][1] == '') return('');
			return(Number(P_coords[data[x]][1]));
		}
	}, {
		title: _('Type'),
		ftext: function(x, col) {return P_type[data[x]]}
	}, {
		title: _('Code'),
		ftext: function(x, col) {return P_code[data[x]]}
	}, {
		title: DwrConf.STATE,
		ftext: function(x, col) {return printPlacesIndexColText(data, x, DwrConf.STATE)}
	}, {
		title: DwrConf.COUNTRY,
		ftext: function(x, col) {return printPlacesIndexColText(data, x, DwrConf.COUNTRY)}
	}, {
		title: DwrConf.POSTAL,
		ftext: function(x, col) {return printPlacesIndexColText(data, x, DwrConf.POSTAL)}
	}];
	if (Dwr.search.IndexShowBkrefType) columns.push({
		title: _('Enclosed By'),
		ftext: function(x, col) {
			return(($.map(P_enclosed_by[data[x]], function(enc) {return P_name[enc.pdx]})).join('<br>'));
			}
	});
	if (Dwr.search.IndexShowBkrefType) columns.push({
		title: _('Used for person'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'P', data[x], 'bki', 'I', 'name', indiHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_families_pages) columns.push({
		title: _('Used for family'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'P', data[x], 'bkf', 'F', 'name', famHrefOptimized)},
		fsort: false
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return P_gid[data[x]]},
		fhref: function(x) {return placeHrefOptimized(data[x])}
	});
	return PrintIndexTable('P', header, data, [[(Dwr.search.HideGid ? 0 : 1), 'asc']], columns);
}

var max_nb_tree_subnodes = 0;

function htmlPlacesIndexTree(header, data)
{
	var scripts = [
		['P', 'names'],
		['P', 'letter'],
		['P', 'type'],
		['P', 'enclosed_by'],
		['P', 'bkp']
	];
	if (!Dwr.search.HideGid) scripts.push(['P', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	var fText = function(pdx)
	{
		// Add place to the map
		pagePlaces.push({pdx: pdx, idx: -1, fdx: -1, edx: -1});
		var txt = '<a href="' + placeHrefOptimized(pdx) + '">';
		txt += placeNames(P_names[pdx]);
		if (!Dwr.search.HideGid) txt += gidBadge(P_gid[pdx]);
		txt += ' (' + P_type[pdx] + ')';
		txt += '</a>';
		return txt;
	};

	// Build tree data (first pass to get max_nb_tree_subnodes)
	var treedata = BuildTreeData(data, fText, null);

	// Optimization
	if (max_nb_tree_subnodes > TREE_OPTIMIZATION_LIMIT)
	{
		console.log('Too many tree nodes (' + data.length + '). Disabling tree features.');
	}

	if (PageContents == Dwr.PAGE_SEARCH || max_nb_tree_subnodes > TREE_OPTIMIZATION_LIMIT)
	{
		// Show data as list
		
		var sortingAttributes = [
			{
				title: _('Name'),
				id: 'P.list.name',
				fSort: function(a, b) {return(a - b)},
				fLetter: function(pdx) {return P_letter[pdx]}
			},
			{
				title: _('Type'),
				id: 'P.list.type',
				fSort: function(a, b) {return cmp(P_type[a], P_type[b])},
				fLetter: function(pdx) {return P_type[pdx]}
			}
		];
		return PrintIndexList('P', header, data, fText, '', '', '<br>', sortingAttributes, 0);
	}
	else
	{
		// Show data as tree

		// Print title
		var sortingAttributes = [
			{
				title: _('Name'),
				id: 'P.tree.name',
				fSort: function(a, b) {return(a.pdx - b.pdx)}
			},
			{
				title: _('Number'),
				id: 'P.tree.number',
				fSort: function(a, b) {return(b.nb - a.nb)}
			}
		];
		
		var html = '';
		var sorting_way = 0;
		if (header)
		{
			var lts = PrintIndexListTitle(header, data, sortingAttributes, 0);
			html = lts.html;
			sorting_way = lts.sorting_way;
		}

		// Build tree data (second pass)
		treedata = BuildTreeData(data, fText, sortingAttributes[sorting_way].fSort);
		
		// When no data
		if (data.length == 0)
		{
			if (header) return html + '<p>' + _('None') + '</p>';
			return '';
		}
		
		(function(){ // This is used to create instances of local variables
			$(document).ready(function() {
				// Prevent title collapse when the click is not on the title (on text hyperlink for example)
				$('#treeview').click(function (event) {
					var target = $(event.target);
					if ((target.is('a') && target.attr('href').indexOf('#') != 0) ||
						(target.parent().is('a') && target.parent().attr('href').indexOf('#') != 0))
					{
						event.stopImmediatePropagation();
					}
				});
				$('#treeview').treeview({
					data: treedata,
					enableLinks: true,
					highlightSearchResults: false,
					highlightSelected: false,
					levels: 1,
					showBorder: false,
					showTags: true, // data.length <= TREE_OPTIMIZATION_LIMIT
					onNodeCollapsed: function(event, data) {return TreeNodeClick(event, data, false)},
					onNodeExpanded: function(event, data) {return TreeNodeClick(event, data, true)}
				});
			});
		})();
		return html + '<div id="treeview"></div>';
	}
}

function TreeNodeClick(event, data, expand)
{
	// Memorize tree state
	var lsName = 'Expanded:' + window.location.pathname + ':Ptree:' + data.pdx;
	sessionStorage.setItem(lsName, expand ? '1' : "0");
}

function BuildTreeData(data, fText, fSort)
{
	// Build tree data
	var treedata = [];
	for (var x = 0; x < data.length; x += 1)
	{
		var pdx = data[x];
		// Check if the place is enclosed by another place in the data
		var enclosed = false;
		for (var y = 0; y < P_enclosed_by[pdx].length; y += 1)
		{
			if ($.inArray(P_enclosed_by[pdx][y].pdx, data) >= 0)
			{
				enclosed = true;
				continue;
			}
		}
		// If the place is enclosed by another place in the data, no need to use it (it will be included when processing the enclosing place)
		if (!enclosed) treedata.push(ComputePlaceHierarchy(pdx, fText, fSort));
	}
	max_nb_tree_subnodes = Math.max(max_nb_tree_subnodes, treedata.length);
	if (fSort !== null) treedata.sort(fSort);
	return treedata;
}

function ComputePlaceHierarchy(top, fText, fSort)
{
	var node = {
		pdx: top,
		nb: 0,
		text: fText(top),
		selectable: false,
		state: {
			expanded: false
		}
	};
	var nodes = [];
	for (var i = 0; i < P_bkp[top].length; i += 1)
	{
		var subnode = ComputePlaceHierarchy(P_bkp[top][i], fText, fSort);
		nodes.push(subnode);
		node.nb += 1;
		if (typeof(subnode.nodes) !== 'undefined') node.nb += parseInt(subnode.tags[0]);
	}
	if (nodes.length > 0)
	{
		if (fSort) nodes.sort(fSort);
		node.nodes = nodes;
		node.tags = ['' + node.nb];
		max_nb_tree_subnodes = Math.max(max_nb_tree_subnodes, nodes.length);
	}
	// Get memorized state
	var lsName = 'Expanded:' + window.location.pathname + ':Ptree:' + top;
	var expd = sessionStorage.getItem(lsName);
	if (expd !== null && parseInt(expd))
	{
		node.state.expanded = true;
	}
	return node;
}


//=========================================================================================
//=========================================================================== Events Index
//=========================================================================================

function htmlEventsIndex(data)
{
	return PrintIndex('E', _('Events Index'), Dwr.search.IndexTypeE, htmlEventsIndexTable, htmlEventsIndexList, data);
}

function htmlEventsIndexTable(header, data)
{
	var scripts = [
		['E', 'type'],
		['E', 'descr'],
		['E', 'date'],
		['E', 'date_sdn'],
		['E', 'place'],
		['P', 'name']
	];
	if (Dwr.search.IndexShowBkrefType) scripts.push(
		['E', 'bki'],
		['E', 'bkf'],
		['I', 'name'],
		['F', 'name']
	);
	if (!Dwr.search.HideGid) scripts.push(['E', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Type'),
		ftext: function(x, col) {return E_type[data[x]] || empty(_('Without type'))},
		fhref: function(x) {return eventHrefOptimized(data[x])},
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Description'),
		ftext: function(x, col) {return E_descr[data[x]]},
		fhref: function(x) {return eventHrefOptimized(data[x])}
	}, {
		title: _('Date'),
		ftext: function(x, col) {return E_date[data[x]]},
		fsort: function(x, col) {return E_date_sdn[data[x]]}
	}, {
		title: _('Place'),
		ftext: function(x, col) {return P_name[E_place[data[x]]]},
		fhref: function(x) {return placeHrefOptimized(E_place[data[x]])},
		fsort: function(x, col) {return E_place[data[x]]}
	}];
	if (Dwr.search.IndexShowBkrefType) columns.push({
		title: _('Used for person'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_EVENT, 'E', data[x], 'bki', 'I', 'name', indiHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_families_pages) columns.push({
		title: _('Used for family'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_EVENT, 'E', data[x], 'bkf', 'F', 'name', famHrefOptimized)},
		fsort: false
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return E_gid[data[x]]},
		fhref: function(x) {return eventHrefOptimized(data[x])}
	});
	return PrintIndexTable('E', header, data, [[(Dwr.search.HideGid ? 0: 1), 'asc']], columns);
}


function htmlEventsIndexList(header, data)
{
	var scripts = [
		['E', 'type'],
		['E', 'name'],
		['E', 'descr'],
		['E', 'date'],
		['E', 'date_sdn'],
		['E', 'place'],
		['P', 'name']
	];
	if (!Dwr.search.HideGid) scripts.push(['E', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	var fText = function(edx)
	{
		var txt = '<a href="' + eventHrefOptimized(edx) + '">';
		txt += E_name[edx];
		if (!Dwr.search.HideGid) txt += gidBadge(E_gid[edx]);
		txt += '</a>';
		var d = E_date[edx];
		var p = P_name[E_place[edx]];
		if (d && p) txt += ' (' + d + ' - ' + p + ')';
		else if (d) txt += ' (' + d + ')';
		else if (p) txt += ' (' + p + ')';
		return txt;
	};
	var sortingAttributes = [
		{
			title: _('Type'),
			id: 'E.type',
			fSort: function(a, b) {return cmp(a, b)},
			fLetter: false
		},
		{
			title: _('Description'),
			id: 'E.descr',
			fSort: function(a, b) {return cmp(E_descr[a], E_descr[b])},
			fLetter: false
		},
		{
			title: _('Date'),
			id: 'E.date',
			fSort: function(a, b) {return cmp(E_date_sdn[b], E_date_sdn[a])},
			fLetter: false
		},
		{
			title: _('Place'),
			id: 'E.place',
			fSort: function(a, b) {return cmp(E_place[a], E_place[b])},
			fLetter: false
		}
	];
	if (!Dwr.search.HideGid) sortingAttributes.push({
		title: _('ID'),
		id: 'E.gid',
		fSort: function(a, b) {return cmp(E_gid[a], E_gid[b])},
		fLetter: false
	});
	return PrintIndexList('E', header, data, fText, '', '', '<br>', sortingAttributes, 0);
}


//=========================================================================================
//=========================================================================== Notes Index
//=========================================================================================

function htmlNotesIndex(data)
{
	return PrintIndex('T', _('Notes Index'), Dwr.search.IndexTypeT, htmlNotesIndexTable, htmlNotesIndexList, data);
}

function htmlNotesIndexTable(header, data)
{
	var scripts = [
		['T', 'type'],
		['T', 'text']
	];
	if (Dwr.search.IndexShowBkrefType) scripts.push(
		['T', 'bki'],
		['T', 'bkf'],
		['T', 'bkm'],
		['T', 'bks'],
		['T', 'bkr'],
		['T', 'bkp'],
		['T', 'bke'],
		['I', 'name'],
		['F', 'name'],
		['M', 'title'],
		['S', 'title'],
		['R', 'name'],
		['P', 'name'],
		['E', 'gid']
	);
	if (!Dwr.search.HideGid) scripts.push(['T', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Type'),
		ftext: function(x, col) {return T_type[data[x]] || empty(_('Without type'))},
		fhref: function(x) {return noteHrefOptimized(data[x])},
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Text'),
		ftext: function(x, col) {return GetFirstLine(T_text[data[x]])},
		fhref: function(x) {return noteHrefOptimized(data[x])}
	}];
	if (Dwr.search.IndexShowBkrefType) columns.push({
		title: _('Used for person'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'T', data[x], 'bki', 'I', 'name', indiHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_families_pages) columns.push({
		title: _('Used for family'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'T', data[x], 'bkf', 'F', 'name', famHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_gallery) columns.push({
		title: _('Used for media'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'T', data[x], 'bkm', 'M', 'title', mediaHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_sources) columns.push({
		title: _('Used for source'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'T', data[x], 'bks', 'S', 'title', sourceHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_repositories) columns.push({
		title: _('Used for repository'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'T', data[x], 'bkr', 'R', 'name', repoHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_places_pages) columns.push({
		title: _('Used for place'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'T', data[x], 'bkp', 'P', 'name', placeHrefOptimized)},
		fsort: false
	});
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_events_pages) columns.push({
		title: _('Used for event'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_INDEX, 'T', data[x], 'bke', 'E', 'name', eventHrefOptimized)},
		fsort: false
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return T_gid[data[x]]},
		fhref: function(x) {return noteHrefOptimized(data[x])}
	});
	return PrintIndexTable('T', header, data, [[(Dwr.search.HideGid ? 0: 1), 'asc']], columns);
}


function htmlNotesIndexList(header, data)
{
	var scripts = [
		['T', 'type'],
		['T', 'text']
	];
	if (!Dwr.search.HideGid) scripts.push(['T', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	var fText = function(tdx)
	{
		var txt = '<a href="' + noteHrefOptimized(tdx) + '">';
		txt += T_type[tdx] || empty(_('Without type'));
		if (!Dwr.search.HideGid) txt += gidBadge(T_gid[tdx]);
		txt += ': ' + GetFirstLine(T_text[tdx]);
		txt += '</a>';
		return txt;
	};
	var sortingAttributes = [
		{
			title: _('Type'),
			id: 'T.type',
			fSort: function(a, b) {return cmp(a, b)},
			fLetter: false
		},
		{
			title: _('Text'),
			id: 'T.text',
			fSort: function(a, b) {return cmp(GetFirstLine(T_text[a]), GetFirstLine(T_text[b]))},
			fLetter: false
		}
	];
	if (!Dwr.search.HideGid) sortingAttributes.push({
		title: _('ID'),
		id: 'T.gid',
		fSort: function(a, b) {return cmp(T_gid[a], T_gid[b])},
		fLetter: false
	});
	return PrintIndexList('T', header, data, fText, '', '', '<br>', sortingAttributes, 0);
}


//=========================================================================================
//========================================================================= Addresses Index
//=========================================================================================

function htmlAddressesIndex()
{
	var scripts = [
		['I', 'name'],
		['I', 'addrs'],
		['I', 'urls']
	];
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Build addresses table
	var adtable = [];
	var empty_loc = [];
	var empty_url = {type: '', uri: '', descr: ''};
	for (var x_i = 0; x_i < DwrConf.db_sizes['I']; x_i++)
	{
		for (var x_ad = 0; x_ad < I(x_i, 'addrs').length; x_ad++)
			adtable.push([x_i, I(x_i, 'addrs')[x_ad].location, empty_url])
		for (var x_url = 0; x_url < I(x_i, 'urls').length; x_url++)
			adtable.push([x_i, empty_loc, I(x_i, 'urls')[x_url]])
	}
	// Print table
	var columns = [{
		title: _('Person'),
		ftext: function(x_ad, col) {return I_name[adtable[x_ad][0]] || empty(_('Without name'))},
		fhref: function(x_ad) {return indiHrefOptimized(adtable[x_ad][0])},
		fsort: function(x, col) {return adtable[x_ad][0]}
	}, {
		title: _('Address'),
		ftext: function(x_ad, col) {return locationString(adtable[x_ad][1])},
	}, {
		title: _('Web Link'),
		ftext: function(x_ad, col) {return(adtable[x_ad][2].descr || adtable[x_ad][2].uri)},
		fhref: function(x_ad) {return adtable[x_ad][2].uri}
	}];
	return PrintIndexTable('addr', _('Addresses'), adtable, [[0, 'asc']], columns);
}


//=========================================================================================
//====================================================================== Repositories Index
//=========================================================================================

function htmlReposIndex(data)
{
	return PrintIndex('R', _('Repositories Index'), true, htmlReposIndexTable, null, data);
}

function htmlReposIndexTable(header, data)
{
	var scripts = [
		['R', 'name'],
		['R', 'type'],
		['R', 'addrs'],
		['R', 'urls']
	];
	if (Dwr.search.IndexShowBkrefType) scripts.push(
		['R', 'bks'],
		['S', 'title']
	);
	if (!Dwr.search.HideGid) scripts.push(['R', 'gid']);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Repository'),
		ftext: function(x, col) {return R_name[data[x]] || empty(_('Without name'))},
		fhref: repoHrefOptimized,
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Type'),
		ftext: function(x, col) {return R_type[data[x]]},
	}, {
		title: _('Addresses'),
		ftext: function(x, col) {
			return(($.map(R_addrs[data[x]], locationString)).join('<br>'));
		},
	}, {
		title: _('Web Links'),
		ftext: function(x, col) {
			return(($.map(R_urls[data[x]], function(url) {
				return('<a class="dwr-index" href="' + url.uri + '">' + (url.descr || url.uri) + '</a>');
			})).join('<br>'));
		},
	}];
	if (Dwr.search.IndexShowBkrefType && DwrConf.inc_sources) columns.push({
		title: _('Used for source'),
		ftext: function(x, col) {return indexBkrefName(BKREF_TYPE_REPO, 'R', data[x], 'bks', 'S', 'title', sourceHrefOptimized)},
		fsort: false
	});
	if (!Dwr.search.HideGid) columns.unshift({
		title: _('ID'),
		ftext: function(x, col) {return R_gid[data[x]]},
		fhref: function(x) {return repoHrefOptimized(data[x])}
	});
	return PrintIndexTable('R', header, data, [[(Dwr.search.HideGid ? 0 : 1), 'asc']], columns);
}


//=========================================================================================
//========================================================================== Surnames index
//=========================================================================================

function printSurnameIndex()
{
	if (Dwr.search.Ndx >= 0)
	{
		var html = '';
		if (N(Dwr.search.Ndx, 'persons').length == 0)
		{
			html += '<p>' + _('No matching surname.') + '</p>';
		}
		else if (N(Dwr.search.Ndx, 'persons').length == 1)
		{
			window.location.replace(indiHref(N(Dwr.search.Ndx, 'persons')[0]));
		}
		else
		{
			var txt = htmlPersonsIndex(N(Dwr.search.Ndx, 'persons'));
			html +=
				'<h2 class="page-header">' +
				(N(Dwr.search.Ndx, 'surname') || empty(_('Without surname'))) +
				'</h2>' +
				txt;
		}
		return html;
	}
	else
	{
		return printSurnamesIndex();
	}
}


function htmlSurnamesIndex(data)
{
	return PrintIndex('N', _('Surnames Index'), Dwr.search.IndexTypeN, htmlSurnamesIndexTable, htmlSurnamesIndexList, data);
}


function htmlSurnamesIndexTable(header, data)
{
	var scripts = [
		['N', 'surname'],
		['N', 'persons']
	];
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	// Define columns and build table
	var columns = [{
		title: _('Surname'),
		ftext: function(x, col) {return N_surname[data[x]] || empty(_('Without surname'))},
		fhref: function(x) {return surnameHrefOptimized(data[x])},
		fsort: function(x, col) {return data[x]}
	}, {
		title: _('Number'),
		ftext: function(x, col) {return '' + N_persons[data[x]].length},
		fhref: false,
		fsort: function(x, col) {return N_persons[data[x]].length}
	}];
	return PrintIndexTable('N', header, data, [[0, 'asc']], columns);
}


function htmlSurnamesIndexList(header, data)
{
	var scripts = [
		['N', 'surname'],
		['N', 'letter'],
		['N', 'persons']
	];
	PrepareFieldSplitScripts(scripts);
	if (preloadMode) return '';

	var fText = function(ndx)
	{
		return(
			'&nbsp;<a href="' + surnameHrefOptimized(ndx) + '">' +
			(N_surname[ndx] || empty(_('Without surname'))) +
			'</a>&nbsp;<span class="dwr-number">(' + N_persons[ndx].length + ')</span>&nbsp;');
	};
	var sortingAttributes = [
		{
			title: _('Surname'),
			id: 'N.surname',
			fSort: function(a, b) {return(a - b)},
			fLetter: function(ndx) {return N_letter[ndx]}
		},
		{
			title: _('Number'),
			id: 'N.number',
			fSort: function(a, b) {return cmp(N_persons[b].length, N_persons[a].length)}
		}
	];
	return PrintIndexList('N', header, data, fText, '', '', ' ', sortingAttributes, 0);
}


//=================================================================
//================================================= Back references
//=================================================================

var BKREF_TYPE_INDEX = 0;
var BKREF_TYPE_MEDIA = 1;
var BKREF_TYPE_SOURCE = 2;
var BKREF_TYPE_REPO = 3;
var BKREF_TYPE_REPOREF = 4;
var BKREF_TYPE_EVENT = 5;

function printBackRefs(type, bki, bkf, bks, bkm, bkp, bkr, bke)
{
	var html = '';
	html += printBackRef(type, bki, indiHref, function(ref) {return I(ref, 'name')});
	if (DwrConf.inc_families_pages)
		html += printBackRef(type, bkf, famHref, function(ref) {return F(ref, 'name')});
	else
		html += printBackRef(type, bkf, null, function(ref) {return F(ref, 'name')});
	if (DwrConf.inc_sources)
		html += printBackRef(type, bks, sourceHref, sourName);
	if (DwrConf.inc_gallery)
		html += printBackRef(type, bkm, mediaHref, mediaName);
	if (DwrConf.inc_places_pages)
		html += printBackRef(type, bkp, placeHref, function(ref) {
			// Add place to the map
			pagePlaces.push({pdx: ref, idx: -1, fdx: -1, edx: -1});
			return P(ref, 'name');
		});
	if (DwrConf.inc_repositories)
		html += printBackRef(type, bkr, repoHref, function(ref) {return R(ref, 'name')});
	if (DwrConf.inc_events_pages)
		html += printBackRef(type, bke, eventHref, function(ref) {return E(ref, 'name')});
	if (html == '') return('');
	return('<ul class="dwr-backrefs">' + html + '</ul>');
}

function printBackRef(type, bk_table, fref, fname)
{
	var my_fref = function(ref, txt) {
		if (fref == null) return(txt);
		return('<a href="' + fref(ref) + '">' + txt + '</a>');
	};
	var html = '';
	var j;
	for (j = 0; j < bk_table.length; j++)
	{
		var ref = bk_table[j];
		var txt = '';
		if (type == BKREF_TYPE_INDEX)
		{
			// This is a citation, person or family back reference
			txt = my_fref(ref, fname(ref));
		}
		else if (type == BKREF_TYPE_MEDIA)
		{
			// This is a media back reference
			txt = my_fref(ref.bk_idx, fname(ref.bk_idx));
			txt += citaLinks(ref.cita);
			if (ref.notes.length > 0)
			{
				txt = '<div>' + txt;
				txt += NotesString(ref.notes, '<p>');
				txt += '</div>';
			}
		}
		else if (type == BKREF_TYPE_EVENT)
		{
			// This is an event back reference
			txt = my_fref(ref.bk_idx, fname(ref.bk_idx));
			txt += citaLinks(ref.cita);
			if (ref.notes.length > 0)
			{
				txt = '<div>' + txt;
				txt += NotesString(ref.notes, '<p>');
				txt += '</div>';
			}
		}
		else if (type == BKREF_TYPE_REPO || type == BKREF_TYPE_REPOREF)
		{
			var idx = (type == BKREF_TYPE_REPO) ? ref.s_idx : ref.r_idx;
			// This is a repository back reference
			txt = my_fref(idx, fname(idx));
			if (ref.media_type != '')
				txt += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Media Type') + ': </span>' + ref.media_type + '</p>';
			if (ref.call_number != '')
				txt += '<p class="dwr-attr-value"><span class="dwr-attr-title">' + _('Call Number') + ': </span>' + ref.call_number + '</p>';
			if (ref.notes.length > 0)
			{
				txt = '<div>' + txt;
				txt += NotesString(ref.notes, '<p>');
				txt += '</div>';
			}
		}
		html += '<li>' + txt + '</li>';
	}
	return(html);
}


//=================================================================
//============================================================ Maps
//=================================================================

var mapObject;


function printMap(enabled)
{
	if (!enabled || !DwrConf.inc_places_pages) return([]);
	// Check if there is at least 1 place with coordinates defined
	var found = false;
	for (var j = 0; j < pagePlaces.length; j++)
	{
		var pdx = pagePlaces[j].pdx;
		if (P(pdx, 'coords').join('') != '') found = true;
	}
	if (!found) return([]);
	// Schedule the differed update of the map
	if (Dwr.search.TabbedPanels && !Dwr.search.MapExpanded)
		$(window).load(function () {
			if ($('.tab-pane.active.dwr-panel-map').length > 0)
			{
				// The map is already the active tab
				mapUpdate();
			}
			else
			{
				// Waiting for the map to be the active tab
				$('a.dwr-panel-map').on('shown.bs.tab', mapUpdate);
			}
		});
	else if (!Dwr.search.TabbedPanels && !Dwr.search.MapExpanded)
		$(window).load(function () {
			if ($('div.dwr-panel-map > .panel-heading.collapsed').length > 0)
			{
				// Wait for the map to be uncollapsed
				$('div.dwr-panel-map > .collapse').on('shown.bs.collapse', mapUpdate);
			}
			else
			{
				// The map is already shown (not collapsed)
				mapUpdate();
			}
		});
	else
	{
		$(window).load(mapUpdate);
	}
	// Build HTML
	var contents = {
		title: _('Map'),
		text:'<div id="gmap_canvas"></div>',
		panelclass: 'dwr-panel-map'
	};
	if (Dwr.search.MapExpanded)
	{
		$('body').addClass('dwr-fullscreen');
		$('body').children().css('display', 'none');
	}
	return([contents]);
}


var mapUpdated = false;

function mapUpdate()
{
	if (mapUpdated) return;
	mapUpdated = true;
	// Check if online
	if (DwrConf.mapservice == 'Google' && typeof(google) === 'undefined') return;
	if (DwrConf.mapservice == 'OpenStreetMap' && typeof(ol) === 'undefined') return;
	// Expand map if required
	if (Dwr.search.MapExpanded)
	{
		$('body').prepend($('#gmap_canvas'));
		$('#gmap_canvas').addClass('dwr-expanded');
		mapResize();
		$(window).resize(mapResize);
	}
	// Get all the coordinates, SW and NE coordinates
	var mapCoords = []; // List of markers coordinates
	var mapGotit = []; // List of markers coordinates already found
	var markerPaces = []; // List of markers places index in table pagePlaces
	var south = 1e10;
	var north = -1e10;
	var west = -1e10;
	var east = 1e10;
	var osmFromProj = 'EPSG:4326';
	var osmToProj = 'EPSG:3857';
	for (var x_place = 0; x_place < pagePlaces.length; x_place++)
	{
		var pdx = pagePlaces[x_place].pdx;
		var lat = Number(P(pdx, 'coords')[0]);
		var lon = Number(P(pdx, 'coords')[1]);
		var sc = P(pdx, 'coords').join('');
		// Check if coordinates are valid
		if (sc != '')
		{
			var x_marker = $.inArray(sc, mapGotit);
			// Check if coordinates are not already in the list
			if (x_marker == -1)
			{
				x_marker = mapGotit.length;
				mapGotit.push(sc);
				markerPaces[x_marker] = [];
			}
			if (DwrConf.mapservice == 'Google')
			{
				mapCoords[x_marker] = new google.maps.LatLng(lat, lon);
			}
			else if (DwrConf.mapservice == 'OpenStreetMap')
			{
				// mapCoords[mapCoords.length] = [lon, lat];
				mapCoords[x_marker] = ol.proj.transform([lon, lat], osmFromProj, osmToProj);
			}
			markerPaces[x_marker].push(x_place);
			south = Math.min(south, lat);
			north = Math.max(north, lat);
			west = Math.max(west, lon);
			east = Math.min(east, lon);
		}
	}
	// Compute optimal zoom
	var angleW = west - east;
	if (angleW < 0) angleW += 360;
	var zoom = 7;
	if (angleW > 0)
	{
		var GLOBE_WIDTH = 256;
		var GLOBE_HEIGHT = 256;
		var pixelW = $('#gmap_canvas').width();
		var zoomW = Math.log(pixelW * 360 / angleW / GLOBE_WIDTH) / Math.LN2;
		function latRad(lat) {
			var sin = Math.sin(lat * Math.PI / 180);
			var radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
			return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
		}
		var angleH = latRad(north) - latRad(south);
		var pixelH = $('#gmap_canvas').height();
		var zoomH = Math.log(pixelH * Math.PI / angleH / GLOBE_HEIGHT) / Math.LN2;
		zoom = Math.floor(Math.min(zoomW, zoomH) / 1.1);
		zoom = Math.min(zoom, 15);
		zoom = Math.max(zoom, 1);
	}
	// Update map
	var osmVectorSource;
	// var osmMarkers;
	if (DwrConf.mapservice == 'Google')
	{
		var centerCoord = new google.maps.LatLng((south + north) / 2, (west + east) / 2);
		var mapOptions = {
			scaleControl:    true,
			panControl:      true,
			backgroundColor: '#000000',
			draggable:       true,
			zoom:            zoom,
			center:          centerCoord,
			mapTypeId:       google.maps.MapTypeId.ROADMAP
		}
		mapObject = new google.maps.Map(document.getElementById('gmap_canvas'), mapOptions);
		// Expand event
		google.maps.event.addListener(mapObject, 'click', mapExpand);
	}
	else if (DwrConf.mapservice == 'OpenStreetMap')
	{
		var centerCoord = [(west + east) / 2, (south + north) / 2];
		var centerCoord = ol.proj.transform([(west + east) / 2, (south + north) / 2], osmFromProj, osmToProj);
		mapObject = new ol.Map({
			target: $('#gmap_canvas')[0],
			layers: [
				new ol.layer.Tile({
					source: new ol.source.OSM()
				})
			],
			view: new ol.View({
				center: centerCoord,
				zoom: zoom
			})
		});
		osmVectorSource = new ol.source.Vector({});
		// osmMarkers = new ol.Layer.Markers('Markers');
		// Expand event
		mapObject.on('singleclick', mapExpand);
	}
	
	// Place markers
	var points = [];
	var nb_max = 0;
	var GetIconProps = function(x_marker)
	{
		var point = points[x_marker];
		var nb = point.nb_birth + point.nb_marr + point.nb_death + point.nb_other;
		nb = Math.max(nb, 1);
		var src = '';
		if (point.nb_birth == nb)
			src = 'data/gramps-geo-birth.png';
		else if (point.nb_marr == nb)
			src = 'data/gramps-geo-marriage.png';
		else if (point.nb_death == nb)
			src = 'data/gramps-geo-death.png';
		else
			src = 'data/gramps-geo-mainmap.png';
		var scale = 0.5 + 1.0 * nb / Math.max(nb_max, 5);
		return({
			src: src,
			scale: scale,
			size: {w: Math.round(48 * scale), h: Math.round(48 * scale)},
			anchor: {x: Math.round(0.1 * 48 * scale), y: Math.round(0.9 * 48 * scale)}
		});
	}
	// Optimization
	if (mapCoords.length > MAP_OPTIMIZATION_LIMIT)
	{
		console.log('Too many markers (' + mapCoords.length + '). Disabling fancy features.');
		mapCoords = [];
		markerPaces = [];
	}
	for (var x_marker = 0; x_marker < mapCoords.length; x_marker++)
	{
		// Sort markerPaces by name
		markerPaces[x_marker].sort(function(a, b) {
			return(P(pagePlaces[a].pdx, 'name').localeCompare(P(pagePlaces[b].pdx, 'name')));
		});
		// Build markers data
		var point = {
			mapName: '',
			mapInfo: '',
			nb_other: 0,
			nb_birth: 0,
			nb_marr: 0,
			nb_death: 0
		};
		var previous_pdx = -1;
		var previous_ul = false;
		for (var x_place = 0; x_place < markerPaces[x_marker].length; x_place++)
		{
			var pp = pagePlaces[markerPaces[x_marker][x_place]];
			var pdx = pp.pdx;
			if (pdx != previous_pdx)
			{
				if (point.mapName) point.mapName += '\n';
				point.mapName += P(pdx, 'name');
				if (previous_ul) point.mapInfo += '</ul>';
				point.mapInfo += '<p class="dwr-mapinfo"><a href="' + placeHref(pdx) + '">' + P(pdx, 'name') + '</a></p>';
				previous_pdx = pdx;
				previous_ul = false;
			}
			var txt = '';
			if (pp.idx >= 0)
			{
				txt += indiLinked(pp.idx, false);
			}
			if (pp.fdx >= 0)
			{
				txt += famLinked(pp.fdx, false);
			}
			if (pp.edx >= 0)
			{
				txt += ' (' + (E(pp.edx, 'type') || E(pp.edx, 'descr')) + ')';
			}
			if (txt)
			{
				if (!previous_ul) point.mapInfo += '<ul class="dwr-mapinfo">';
				previous_ul = true;
				point.mapInfo += '<li class="dwr-mapinfo">' + txt + '</li>';
				if ($.inArray(E(pp.edx, 'type'), EVENTS_BIRTH) >= 0)
					point.nb_birth += 1;
				else if ($.inArray(E(pp.edx, 'type'), EVENTS_MARR) >= 0)
					point.nb_marr += 1;
				else if ($.inArray(E(pp.edx, 'type'), EVENTS_DEATH) >= 0)
					point.nb_death += 1;
				else
					point.nb_other += 1;
			}
		}
		if (previous_ul) point.mapInfo += '</ul>';
		nb_max = Math.max(nb_max, point.nb_birth + point.nb_marr + point.nb_death + point.nb_other);
		points[x_marker] = point;
		// Print marker
		if (DwrConf.mapservice == 'Google')
		{
			(function(){ // This is used to create instances of local variables
				var ip = GetIconProps(x_marker);
				var marker = new google.maps.Marker({
					position:  mapCoords[x_marker],
					// draggable: true,
					title:     point.mapName,
					map:       mapObject,
					icon: {
						anchor: new google.maps.Point(ip.anchor.x, ip.anchor.y),
						scaledSize: new google.maps.Size(ip.size.w, ip.size.h),
						url: ip.src
					}
				});
				var infowindow = new google.maps.InfoWindow({
					content: point.mapInfo
				});
				google.maps.event.addListener(marker, 'click', function() {
					infowindow.open(mapObject, marker);
				});
			})();
		}
		else if (DwrConf.mapservice == 'OpenStreetMap')
		{
			(function(){ // This is used to create instances of local variables
				var popupname = 'OsmPopup' + x_marker;
				// Create the OpenLayers icon
				var coord = new ol.geom.Point(mapCoords[x_marker]);
				var iconFeature = new ol.Feature({
					geometry: coord,
					name: popupname
				});
				osmVectorSource.addFeature(iconFeature);
				// Create the OpenLayers overlay div
				var popupdiv = $('#gmap_canvas').append('<div id="' + popupname + '"></div>').children().last();
				var popup = new ol.Overlay({
					element: popupdiv[0],
					positioning: 'top-center',
					stopEvent: false
				});
				mapObject.addOverlay(popup);
				// Create the bootstrap popup
				popupdiv.popover({
					'placement': 'top',
					'html': true,
					'title': point.mapName,
					'content': point.mapInfo
				});
				popupdiv.popover('hide');

				popupdiv.on('show.bs.popover', function () {
					// alert('show ' + this.id);
					inhibitMapExpand = true;
				})
				popupdiv.on('hide.bs.popover', function () {
					// alert('hide ' + this.id);
					inhibitMapExpand = true;
				})
			})();
		}
	}
	if (DwrConf.mapservice == 'OpenStreetMap')
	{
		var OsmPointStyle = function(feature, resolution)
		{
			var x_marker = parseInt(feature.p.name.replace('OsmPopup', ''));
			var ip = GetIconProps(x_marker);
			var iconStyle = new ol.style.Style({
				image: new ol.style.Icon(({
					anchor: [ip.anchor.x, ip.anchor.y],
					anchorXUnits: 'pixels',
					anchorYUnits: 'pixels',
					scale: ip.scale,
					src: ip.src
				}))
			});
			return([iconStyle]);
		};

		var vectorLayer = new ol.layer.Vector({
			source: osmVectorSource,
			style: OsmPointStyle
			// style: iconStyle
		});
		mapObject.addLayer(vectorLayer);
		mapObject.on('click', OsmClick);
		$(mapObject.getViewport()).on('mousemove', OsmMove);
	}
}

var inhibitMapExpand = false;

function mapExpand()
{
	if (inhibitMapExpand) return(false);
	Dwr.search.MapExpanded = !($('body').hasClass('dwr-fullscreen'));
	Dwr.Redirect();
	return(false);
}


function mapResize()
{
	var div = $('.dwr-expanded');
	if (div.length != 1) return(true);
	var w = $(window).width();
	var h = $(window).height();
	div.width(w);
	div.height(h);
	if (mapObject) mapObject.checkResize();
	return(true);
}


function OsmClick(event)
{
	// Display OpenLayers popup on click

	// Get the popup divs
	var popupdivs = $('#gmap_canvas').find('div').filter(function(index) {
		return(this.id.indexOf('OsmPopup') == 0);
	})

	// Get the icon clicked
	var feature = mapObject.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
		return feature;
	});
	var popupname = '';
	var coord;
	if (feature)
	{
		var geometry = feature.getGeometry();
		coord = geometry.getCoordinates();
		popupname = feature.get('name');
	}

	// Hide all OpenLayers popups except the for clicked icon
	var overlays = mapObject.getOverlays();
	var overlay;
	for (var i = 0; i < overlays.getLength(); i++)
	{
		if (overlays.item(i).getElement().id == popupname) overlay = overlays.item(i);
	}

	inhibitMapExpand = false;
	popupdivs.each(function() {
		if (this.id == popupname)
		{
			overlay.setPosition(coord);
			$(this).popover('show');
		}
		else if ($(this).next('div.popover:visible').length)
		{
			$(this).popover('hide');
		}
	});

	return(false);
}

function OsmMove(event)
{
	// Change OpenLayers mouse cursor when over marker
	var pixel = mapObject.getEventPixel(event.originalEvent);
	var hit = mapObject.forEachFeatureAtPixel(pixel, function(feature, layer) {
		return true;
	});
	if (hit)
	{
		$(mapObject.getTarget()).css('cursor', 'pointer');
	}
	else
	{
		$(mapObject.getTarget()).css('cursor', '');
	}
}


//=================================================================
//================================================== Search by name
//=================================================================

function SearchFromString(ss, data, fextract)
{
	ss = unorm.nfkc(ss).toLowerCase();
	var terms = ss.match(/[^\s]+/ig);
	var results = [];
	if (terms == null) return(results);
	for (var x = 0; x < DwrConf.db_sizes[data]; x++)
	{
		var found = true;
		var s = fextract(x);
		s = unorm.nfkc(s).toLowerCase();
		for (var j = 0; j < terms.length; j++)
		{
			if (s.match(terms[j]) == null) found = false;
		}
		if (found) results.push(x);
		// console.log(found + ': '+ ss+'  /  '+s);
	}
	return(results);
}


function SearchObjects()
{
	var scripts = [
		['I', 'name'],
		['M', 'title'],
		['S', 'title'],
		['S', 'author'],
		['S', 'abbrev'],
		['S', 'publ'],
		['P', 'names']
	];
	if (Dwr.search.IndexShowPath) scripts.push(['M', 'gramps_path']);
	if (!Dwr.search.HideGid) scripts.push(
		['I', 'gid'],
		['M', 'gid'],
		['S', 'gid'],
		['P', 'gid']
	);
	PrepareFieldSplitScripts(scripts);
	if (preloadMode)
	{
		// Preload data for indexes also
		htmlPersonsIndex();
		htmlMediaIndex();
		htmlSourcesIndex();
		htmlPlacesIndex();
		return '';
	}

	// Describe where to search
	var types = [
		{
			data: 'I',
			fextract: function(idx) {return(I_name[idx] +
				(Dwr.search.HideGid ? '' : ' ' + I_gid[idx]));
			},
			text: _('Persons'),
			findex: htmlPersonsIndex,
			fref: indiHref
		},
		{
			data: 'M',
			fextract: function(mdx) {return(M_title[mdx] +
				(Dwr.search.IndexShowPath ? ' ' + M_gramps_path[mdx] : '') +
				(Dwr.search.HideGid ? '' : ' ' + M_gid[mdx]))},
			text: _('Media'),
			findex: htmlMediaIndex,
			fref: mediaHref
		},
		{
			data: 'S',
			fextract: function(sdx) {return(S_title[sdx] + ' ' + S_author[sdx] + ' ' + S_abbrev[sdx] + ' ' + S_publ[sdx] +
				(Dwr.search.HideGid ? '' : ' ' + S_gid[sdx]))},
			text: _('Sources'),
			findex: htmlSourcesIndex,
			fref: sourceHref
		},
		{
			data: 'P',
			fextract: function(pdx) {return(
				P_names[pdx].map(function(v, i, a) {return v.name}).join(' ') +
				(Dwr.search.HideGid ? '' : ' ' + P_gid[pdx]))},
			text: _('Places'),
			findex: htmlPlacesIndex,
			fref: placeHref
		}
	];
	// Search
	var x;
	var nb_found = 0;
	var fref;
	var index;
	var html = '';
	var contents = [];
	for (x = 0; x < types.length; x++)
	{
		var results;
		var type = types[x];
		results = SearchFromString(Dwr.search.Txt, type.data, type.fextract);
		nb_found += results.length;
		if (results.length == 1 && x == 0)
		{
			// Only 1 person found, redirect to the person page
			fref = type.fref;
			index = results[0];
			break;
		}
		if (results.length > 0)
		{
			fref = type.fref;
			index = results[0];
			contents.push({
				title: type.text + ' (' + results.length + ')',
				text: type.findex(results)
			});
		}
	}
	html += PrintTitle('Search', 3, contents)
	if (nb_found == 1)
	{
		window.location.replace(fref(index));
		html = '';
	}
	else if (nb_found == 0)
	{
		html = '';
		if (Dwr.search.Txt != '')
		{
			html += '<p>' + _('No matches found') + '</p>';
			$('#dwr-search-0-txt').focus();
		}
		html += '<p>' + _('Use the search box above in order to find a person.') + '</p>';
	}
	else
	{
		html = ('<p>' + _('Several matches.<br>Precise your search or choose in the lists below.') + '</p>') + html;
	}
	return(html);
}


//=================================================================
//======================================================= Gramps ID
//=================================================================

function ManageSearchStringGids()
{
	// Select between index in table or GID (mutually exclusive)
	var gidTable = [
		['Igid', 'Idx', 'I'],
		['Fgid', 'Fdx', 'F'],
		['Mgid', 'Mdx', 'M'],
		['Sgid', 'Sdx', 'S'],
		['Pgid', 'Pdx', 'P'],
		['Rgid', 'Rdx', 'R']
	];
	for (var i = 0; i < gidTable.length; i += 1)
	{
		// Change GID into index in table
		var gid = gidTable[i][0];
		var dx = gidTable[i][1];
		var table = gidTable[i][2];
		if (Dwr.search[gid] != '' && Dwr.search[dx] < 0)
		{
			var xgid = window[table + '_xgid'];
			if (typeof(xgid) === 'undefined')
			{
				PreloadScripts(['dwr_db_' + table + '_xgid.js'], true);
				return;
			}
			if (xgid[Dwr.search[gid]])
			{
				Dwr.search[dx] = xgid[Dwr.search[gid]];
			}
		}
		Dwr.search[gid] = '';
	}
}


//=================================================================
//======================================================== Calendar
//=================================================================

function printCalendar()
{
	var html = '';
	html += 'printCalendar not implemented';
	return html;
}



//=================================================================
//============================================================ Home
//=================================================================

function HomePage()
{
	var html = '';
	html += '<h1>' + DwrConf.title + '</h1>';
	html += '<p>';
	var tables = [
		['N', 'surnames.html'],
        ['I', 'persons.html'],
        ['F', 'families.html'],
        ['S', 'sources.html'],
        ['M', 'medias.html'],
        ['P', 'places.html'],
        ['R', 'repositories.html'],
        ['E', 'events.html'],
        ['T', 'notes.html']
	];
	var sep = '';
	for (var i = 0; i < tables.length; i += 1)
	{
		for (var j = 0; j < DwrConf.pages_menu_index.length; j += 1)
		{
			if (tables[i][1] != DwrConf.pages_menu_index[j][0]) continue;
			html += sep
			html +=	'<a href="' + tables[i][1] + '?' + Dwr.BuildSearchString() + '">';
			html +=	DwrConf.pages_menu_index[j][1] + ': ' + DwrConf.db_sizes[tables[i][0]];
			html +=	'</a>';
			sep = '<br>';
		}
	}
	html += '<br> <p>' + Dwr.embedSearchText() + '<p>';
	return html;
}



//=================================================================
//========================================================== Config
//=================================================================

function ConfigPage()
{
	var html = '';
	html += '<h1>' + _('Configuration') + '</h1>';
	html += '<div class="panel panel-default">';
	html += '<div class="panel-body">';
	html += '<form id="dwr-chart-form" role="form" class="form-horizontal">';

	var configsCheck = [
		['check', 'IndexTypeN', _('Use a table format for the surnames index')],
		['check', 'IndexTypeI', _('Use a table format for the persons index')]
	];
	if (DwrConf.inc_families_pages) configsCheck.push(
		['check', 'IndexTypeF', _('Use a table format for the families index')]);
	if (DwrConf.inc_sources) configsCheck.push(
		['check', 'IndexTypeS', _('Use a table format for the sources index')]);
	if (DwrConf.inc_places_pages) configsCheck.push(
		['check', 'IndexTypeP', _('Use a table format for the places index')]);
	if (DwrConf.inc_events_pages) configsCheck.push(
		['check', 'IndexTypeE', _('Use a table format for the events index')]);
	if (DwrConf.inc_notes_pages) configsCheck.push(
		['check', 'IndexTypeT', _('Use a table format for the notes index')]);
	$.merge(configsCheck, [
		['separator'],
		['check', 'IndexShowDates', _('Include dates columns on the index pages')],
		['check', 'IndexShowPartner', _('Include a column for partners on the index pages')],
		['check', 'IndexShowParents', _('Include a column for parents on the index pages')],
		['check', 'IndexShowPath', _('Include a column for media path on the index pages')],
		['check', 'IndexShowBkrefType', _('Include references in indexes')],
		['separator'],
		['check', 'MapPlace', _('Include Place map on Place Pages')],
		['check', 'MapFamily', _('Include a map in the individuals and family pages')],
		['separator'],
		['check', 'TabbedPanels', _('Use tabbed panels instead of sections')],
		['check', 'ShowAllSiblings', _('Include half and/ or step-siblings on the individual pages')],
		['check', 'SourceAuthorInTitle', _('Insert sources author in the sources title')],
		['check', 'HideGid', _('Suppress Gramps ID')],
		['check', 'IncChangeTime', _('Show last modification time')]
	]);
	html += '<div class="row">';
	for (var i = 0; i < configsCheck.length; i += 1)
	{
		if (configsCheck[i][0] == 'check')
		{
			var opt = configsCheck[i][1];
			html += '<div class="checkbox col-xs-12 col-md-6"><label>';
			html += '<input type="checkbox" id="dwr-cfg-' + opt + '"' + (Dwr.search[opt] ? ' checked' : '') + '>';
			html += configsCheck[i][2] + '</label></div>';
		}
		if (configsCheck[i][0] == 'separator')
		{
			html += '</div><hr><div class="row">';
		}
	}
	html += '</div>';
	html += '<hr>';
	html += '<div class="text-center">';
	html += ' <button id="dwr-config-ok" type="button" class="btn btn-primary"> <span class="glyphicon glyphicon-ok"></span> ' + _('OK') + ' </button> ';
	html += ' <button id="dwr-config-restore" type="button" class="btn btn-secondary"> <span class="glyphicon glyphicon-cog"></span> ' + _('Restore default settings') + ' </button> ';
	html += ' <button id="dwr-config-help" type="button" class="btn btn-secondary"> <span class="glyphicon glyphicon-question-sign"></span> ' + _('Help') + ' </button> ';
	html += '</div>';

	html += '</form>';
	html += '</div>'; // panel-body
	html += '</div>'; // panel

	// Events
	$(window).load(function() {
		$('#dwr-config-ok').click(function() {
			for (var i = 0; i < configsCheck.length; i++)
			{
				if (configsCheck[i][0] == 'check')
				{
					var opt = configsCheck[i][1];
					if (typeof(Dwr.search[opt]) === 'number')
						Dwr.search[opt] = $('#dwr-cfg-' + opt)[0].checked ? 1 : 0;
					else
						Dwr.search[opt] = $('#dwr-cfg-' + opt)[0].checked ? true : false;
				}
			}
			window.location.href = Dwr.search.P + '?' + Dwr.BuildSearchString();
			return(false);
		});
		$('#dwr-config-restore').click(function() {
			for (var i = 0; i < configsCheck.length; i++)
			{
				if (configsCheck[i][0] == 'check')
				{
					var opt = configsCheck[i][1];
					$('#dwr-cfg-' + opt)[0].checked = Dwr.defaultSearchString[opt] ? true : false;
				}
			}
			// Clear local storage where Datatables stores the user preferences
			$.each(sessionStorage, function(key, val) {
				sessionStorage.removeItem(key);
			});
			return(false);
		});
		$('#dwr-config-help').click(Dwr.helpConfRef);
	});

	return(html);
}



//=================================================================
//============================================================ Main
//=================================================================

var PageContents;
var preloadMode;

DwrClass.prototype.Main = function(page)
{
	PageContents = page;
	Dwr.ParseSearchString();
	computeOptimizedHref();
	// First pass preload data, eventually interrupted by exception WaitScriptLoad
	preloadMode = true;
	MainRun();
	$(document).ready(function(){
		// All data is preloaded, reinitialize and print for good
		preloadMode = false;
		duplicates = [];
		pageSources = [];
		pageCitations = [];
		pageCitationsBullets = [];
		pagePlaces = [];
		titlesCollapsible = [];
		titlesTable = [];
		MainRun();
	});
}

function MainRun()
{
	//This function is executed in 2 phases: preload and normal
	// When preload is true:
	//   Builds the page, but without printing anything
	//   This allows to preload all the database files required
	//   In this phase, only the function PreloadScripts writes to the document.
	// When preload is false:
	//   The document is printed
	//
	// During the preload phase, PreloadScripts raises exception after every script loading
	// So, during preload phase, MainRun is executed again and again until no more script needs to be loaded.

	if (ScriptIsLoading())
	{
		if (preloadMode) return;
		throw 'Loading problem';
	}
	var html;
	try
	{
		if (preloadMode) ManageSearchStringGids();

		if ($.inArray(PageContents, [Dwr.PAGE_SVG_TREE_FULL, Dwr.PAGE_SVG_TREE_SAVE, Dwr.PAGE_SVG_TREE_CONF]) < 0) Dwr.search.SvgExpanded = false;
		if (PageContents == Dwr.PAGE_HOME)
		{
			html = HomePage();
		}
		else if (Dwr.search.Idx >= 0 && ($.inArray(PageContents, [Dwr.PAGE_SVG_TREE, Dwr.PAGE_SVG_TREE_FULL, Dwr.PAGE_SVG_TREE_SAVE]) >= 0))
		{
			if (PageContents == Dwr.PAGE_SVG_TREE_FULL) Dwr.search.SvgExpanded = true;
			if (preloadMode)
			{
				searchDuplicate(Dwr.search.Idx);
				DwrSvg.Preload();
			}
			else
			{
				if (PageContents == Dwr.PAGE_SVG_TREE_SAVE) html = DwrSvg.SavePage();
				else html = DwrSvg.Create();
			}
		}
		else if (PageContents == Dwr.PAGE_SVG_TREE_CONF)
		{
			html = DwrSvg.ConfPage();
		}
		else if (Dwr.search.Sdx >= 0 && PageContents == Dwr.PAGE_SOURCE)
		{
			html = printSource(Dwr.search.Sdx);
		}
		else if (Dwr.search.Mdx >= 0 && PageContents == Dwr.PAGE_MEDIA)
		{
			html = printMedia(Dwr.search.Mdx);
		}
		else if (Dwr.search.Idx >= 0 && PageContents == Dwr.PAGE_INDI)
		{
			html = printIndi(Dwr.search.Idx);
		}
		else if (Dwr.search.Fdx >= 0 && PageContents == Dwr.PAGE_FAM && DwrConf.inc_families_pages)
		{
			html = printFam(Dwr.search.Fdx);
		}
		else if (Dwr.search.Pdx >= 0 && PageContents == Dwr.PAGE_PLACE && DwrConf.inc_places_pages)
		{
			html = printPlace(Dwr.search.Pdx);
		}
		else if (Dwr.search.Rdx >= 0 && PageContents == Dwr.PAGE_REPO && DwrConf.inc_repositories)
		{
			html = printRepo(Dwr.search.Rdx);
		}
		else if (Dwr.search.Edx >= 0 && PageContents == Dwr.PAGE_EVENT && DwrConf.inc_events_pages)
		{
			html = printEvent(Dwr.search.Edx);
		}
		else if (Dwr.search.Tdx >= 0 && PageContents == Dwr.PAGE_NOTE && DwrConf.inc_notes_pages)
		{
			html = printNote(Dwr.search.Tdx);
		}
		else if (PageContents == Dwr.PAGE_SEARCH)
		{
			html = SearchObjects();
		}
		else if (PageContents == Dwr.PAGE_CONF)
		{
			html = ConfigPage();
		}
		else if (PageContents == Dwr.PAGE_SURNAMES_INDEX)
		{
			html = htmlSurnamesIndex();
		}
		else if (PageContents == Dwr.PAGE_SURNAME_INDEX)
		{
			html = printSurnameIndex();
		}
		else if (PageContents == Dwr.PAGE_PERSONS_INDEX)
		{
			html = htmlPersonsIndex();
		}
		else if (PageContents == Dwr.PAGE_FAMILIES_INDEX && DwrConf.inc_families_pages)
		{
			html = htmlFamiliesIndex();
		}
		else if (PageContents == Dwr.PAGE_SOURCES_INDEX && DwrConf.inc_sources)
		{
			html = htmlSourcesIndex();
		}
		else if (PageContents == Dwr.PAGE_MEDIA_INDEX && DwrConf.inc_gallery)
		{
			html = htmlMediaIndex();
		}
		else if (PageContents == Dwr.PAGE_PLACES_INDEX && DwrConf.inc_places_pages)
		{
			html = htmlPlacesIndex();
		}
		else if (PageContents == Dwr.PAGE_EVENTS_INDEX && DwrConf.inc_events_pages)
		{
			html = htmlEventsIndex();
		}
		else if (PageContents == Dwr.PAGE_ADDRESSES_INDEX && DwrConf.inc_addresses)
		{
			html = htmlAddressesIndex();
		}
		else if (PageContents == Dwr.PAGE_REPOS_INDEX && DwrConf.inc_repositories)
		{
			html = htmlReposIndex();
		}
		else if (PageContents == Dwr.PAGE_NOTES_INDEX && DwrConf.inc_notes_pages)
		{
			html = htmlNotesIndex();
		}
		else
		{
			// Page without index specified. Redirect to the search page
			window.location.replace(searchHref());
		}
	}
	catch(e)
	{
		// return and wait for next MainRun call
		if (!(e instanceof WaitScriptLoad) || !preloadMode)
		{
			throw e;
		}
	}
	if (!preloadMode)
	{
		if (PageContents == Dwr.PAGE_SVG_TREE_FULL)
		{
			$('body').html(html).toggleClass('dwr-fullscreen');
		}
		else if (PageContents == Dwr.PAGE_SVG_TREE_SAVE)
		{
			if (Dwr.search.SvgExpanded) $('body').html(html);
			else $('#body-page').html(html);
		}
		else if ($.inArray(PageContents, [
			Dwr.PAGE_INDI, Dwr.PAGE_FAM, Dwr.PAGE_SOURCE, Dwr.PAGE_MEDIA, Dwr.PAGE_PLACE, Dwr.PAGE_REPO, Dwr.PAGE_EVENT, Dwr.PAGE_NOTE,
			Dwr.PAGE_SURNAMES_INDEX, Dwr.PAGE_SURNAME_INDEX,
			Dwr.PAGE_PERSONS_INDEX, Dwr.PAGE_FAMILIES_INDEX, Dwr.PAGE_SOURCES_INDEX, Dwr.PAGE_MEDIA_INDEX, Dwr.PAGE_PLACES_INDEX, Dwr.PAGE_REPOS_INDEX, Dwr.PAGE_EVENTS_INDEX, Dwr.PAGE_NOTES_INDEX,
			Dwr.PAGE_ADDRESSES_INDEX
		]) >= 0)
		{
			$('#body-page').html(html);
			HandleCitations();
			HandleTitles();
		}
		else
		{
			$('#body-page').html(html);
		}
	}
}


})(this);
