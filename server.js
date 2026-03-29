require('dotenv').config();
var express = require('express');
var path = require('path');
var crypto = require('crypto');
var multer = require('multer');
var backup = require('./backup');
var db = require('./database');
var gsheets = require('./google-sheets');
