///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2018 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'jimu/BaseWidgetSetting',
  'dijit/_TemplatedMixin',
  'dojo/text!./importUtils.html',
  "dojo/on",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dijit/form/SimpleTextarea"
],
function(declare, BaseWidgetSetting, _TemplatedMixin, template, on, lang, array, SimpleTextarea) {
  return declare([BaseWidgetSetting, _TemplatedMixin], {
    templateString: template,
    baseClass: 'jimu-widget-untrace-setting',
    nls: null,
    token : null,
    un: null,
    cmbDomainNetworks: null,
    domainValueListHelper: [],
    importTrace: {
      "type": "",
      "traceID": ((new Date()).getTime()).toString(),
      "useAsStart": "useExisting",
      "useAsBarrier": "useExisting",
      "startLocationLayers": [],
      "barriersLayers": [],
      "traceColor": {
        "r": 0,
        "g": 0,
        "b": 255,
        "a": 0.7
      },
      "traceConfig":{}
    },
    textInput: null,
    validInput: true,

    postCreate: function(){
      this.textInput = new SimpleTextarea({
        name: "importCode",
        style: "width:100%; height:400px;"
      });
      this.textInput.placeAt(this.inputText);
      this.textInput.startup();

      this.own(on(this.textInput, "change", lang.hitch(this, function(val) {
        this.validateString({pycode: val});
      })));
    },

    validateString: function(param) {
      if(param.pycode !== "") {
        //removing arcpy parts
        var stringSig = param.pycode.slice(param.pycode.indexOf("(")+1);
        stringSig = stringSig.slice(0, -1);
        //Slice apart string into array by comma
        var stringSigArr = stringSig.split(",");
        if(stringSigArr.length >= 30) {
          //get the trace type part
          this.validInput = this.parseNode({value: stringSigArr[1], node:"type", preNode:""});
          //set the target tier
          if(this.validInput) {
            this.validInput = this.parseNode({value: stringSigArr[6], node:"targetTier", preNode:"traceConfig"});
          }
          if(this.validInput) {
            this.validInput = this.parseIncludes({value: stringSigArr[9], node:"includeContainers"});
            this.validInput = this.parseIncludes({value: stringSigArr[10], node:"includeStructLineContent"});
            this.validInput = this.parseIncludes({value: stringSigArr[11], node:"includeStructures"});
            this.validInput = this.parseIncludes({value: stringSigArr[12], node:"includeBarriers"});
          }
          if(this.validInput) {
            this.validInput = this.parseBarriersFilters({value: stringSigArr[14], node:"conditionBarriers"});
          }
          if(this.validInput) {
            this.validInput = this.parseBarriersFilters({value: stringSigArr[17], node:"filterBarriers"});
          }
          if(this.validInput) {
            this.validInput = this.parseBarriersFilters({value: stringSigArr[29], node:"outputConditions"});
          }
          if(this.validInput) {
            this.validInput = this.parseAssetList({value: stringSigArr[28], node:"outputFilters"});
          }
          if(this.validInput) {
            this.validInput = this.parseKNN({
              useNearest: stringSigArr[21],
              count: stringSigArr[22],
              costNetworkAttributeName: stringSigArr[23],
              nearestCategories: stringSigArr[24],
              nearestAssets: stringSigArr[25],
              node:"nearestNeighbor"
            });
          }
        } else {
          this.validInput = false;
          alert("no valid import");
        }
      } else {
        this.validInput = false;
        alert("no valid import");
      }
    },

    parseNode: function(param) {
      if(param.value !== "None") {
        if(param.preNode === "") {
          this.importTrace[param.node] = ((param.value.replace(/"/g, '')).trim()).toLowerCase();
        } else {
          this.importTrace.traceConfig[param.node] = ((param.value.replace(/"/g, '')).trim()).toLowerCase();
        }
        return true;
      } else {
        return false;
      }
    },
    parseIncludes: function(param) {
      if(param.value !== "None") {
          if(param.value.indexOf("INCLUDE") > -1) {
            this.importTrace.traceConfig[param.node] = true;
          } else {
            this.importTrace.traceConfig[param.node] = false;
          }
        return true;
      } else {
        return false;
      }
    },
    parseBarriersFilters: function(param) {
      if(param.value !== "None") {
        var cleanStr = (param.value).trim();
        this.importTrace.traceConfig[param.node] = [];
        if(cleanStr.indexOf(";") > -1) {
          var objList = cleanStr.split(";"); //check if there are multiple conditions by slipting at semicolon
          for(var i=0; i< objList.length; i++) {
            objList[i] = this.handleNamewithSpace(objList[i]);
            var objItems = objList[i].split(" "); //after split, the params are separted by a space. split to make them array
            //notice that if isSpecificValue is true, the type is networkAttribute. it's what is sent to rest.
            this.filterHandler({values: objItems, node:param.node});
          }
        } else {
          var objItems = cleanStr.split(" "); //after split, the params are separted by a space. split to make them array
          objItems = this.handleNamewithSpace(objItems);
          this.filterHandler({values: objItems, node:param.node});
        }
        return true;
      } else {
        this.importTrace.traceConfig[param.node] = [];
        return true;
      }
    },
    parseKNN: function(param) {
      if(param.useNearest !== "None") {
        cleanUseNearest = (param.useNearest.replace(/"/g, "")).trim();
        if(cleanUseNearest !== "DO_NOT_FILTER") {
          this.importTrace.traceConfig[param.node] = {
            "count": parseInt(param.count),
            "costNetworkAttributeName": (param.costNetworkAttributeName.replace(/"/g, "")).trim(),
            "nearestCategories": ((param.nearestCategories.replace(/"/g, "")).trim()).split(";")
          }
          this.validInput = this.parseAssetList({value: param.nearestAssets, node:"nearestAssets",  preNode:"nearestNeighbor"});

        } else {
          this.importTrace.traceConfig[param.node] = {
            "count": -1,
            "costNetworkAttributeName": "",
            "nearestCategories": [],
            "nearestAssets": []
          };
        }
        return true;
      } else {
        return false;
      }
    },
    parseAssetList: function(param) {
      if(param.value !== "None") {
        var assetList = this._createAGATList();
        var cleanStr = (param.value.replace(/["']/g, "")).trim();
        var importList = [];
        if(cleanStr.indexOf(";") > -1) {
          var objList = cleanStr.split(";");
          for(var i=0;i<objList.length;i++) {
            var obj = objList[i].split("/");
            for(var z=0;z<assetList.length;z++) {
              if(assetList[z].assetGroupName === obj[1] && assetList[z].assetTypeName === obj[2]) {
                importList.push({
                  "assetGroupCode": assetList[z].assetGroupCode,
                  "assetTypeCode": assetList[z].assetTypeCode,
                  "networkSourceId": assetList[z].networkSourceId
                });
              }
            }
          }
        } else {
          var obj = cleanStr.split("/");
          for(var z=0;z<assetList.length;z++) {
            if(assetList[z].assetGroupName === obj[1] && assetList[z].assetTypeName === obj[2]) {
              importList.push({
                "assetGroupCode": assetList[z].assetGroupCode,
                "assetTypeCode": assetList[z].assetTypeCode,
                "networkSourceId": assetList[z].networkSourceId
              });
            }
          }
        }
        if(typeof(param.preNode) !== "undefined") {
          this.importTrace.traceConfig[param.preNode][param.node] = importList;
        } else {
          this.importTrace.traceConfig[param.node] = importList;
        }
        return true;
      } else {
        return false;
      }
    },
    //support functions
    filterHandler: function(param) {
      var typeHandler = "specificValue";
      if((param.values[0].replace(/["']/g, "")).replace(/[$]/g, " ") === "Category") {
        typeHandler = "category";
      } else {
        if(param.values[2] === "SPECIFIC_VALUE") {
          typeHandler = "networkAttribute";
        } else {
          typeHandler = this._enumMapper(param.values[2]);
        }
      }

      this.importTrace.traceConfig[param.node].push({
        "name": (param.values[0].replace(/["']/g, "")).replace(/[$]/g, " "),
        "type": typeHandler,
        "operator": this._enumMapper(param.values[1]),
        "value": (param.values[3].replace(/["']/g, "")).replace(/[$]/g, " "),
        "combineUsingOr": (param.values[4] === "OR")? true : false,
        "isSpecificValue": (param.values[2] === "SPECIFIC_VALUE")? true : false
      });
    },
    handleNamewithSpace: function(param) {
      var inputArr = param.match(/'([^']+)'/g);
      if(inputArr !== null) {
        if(inputArr.length > 0) {
          for(var i=0;i<inputArr.length;i++) {
            replaceVal = inputArr[i].replace(/ /g, "$");
            param = param.replace(inputArr[i], replaceVal);
          }
          return param;
        } else {
          return param;
        }
      } else {
        return param;
      }
    },
    _createAGATList: function() {
      var deviceList = this.un.getAGByDevice(this.cmbDomainNetworks);
      var junctionList = this.un.getAGByJunction(this.cmbDomainNetworks);
      var lineList = this.un.getAGByLine(this.cmbDomainNetworks);
      var assetGroupList = deviceList.concat(junctionList, lineList);
      var assetList = [];
      array.forEach(assetGroupList, lang.hitch(this, function(agl) {
        agl.assetGroup.sort((a,b) => (a.assetGroupName > b.assetGroupName) ? 1 : ((b.assetGroupName > a.assetGroupName) ? -1 : 0));
        array.forEach(agl.assetGroup, lang.hitch(this, function(ag) {
          array.forEach(ag.assetTypes, lang.hitch(this, function(at) {
            assetList.push({
              "assetGroupCode": ag.assetGroupCode,
              "assetGroupName": ag.assetGroupName,
              "assetTypeCode": at.assetTypeCode,
              "assetTypeName": at.assetTypeName,
              "networkSourceId": agl.sourceId,
              "layerId": agl.layerId
            });
          }));
        }));
      }));
      return assetList;
    },
    _enumMapper: function(param) {
      var list = {
        "IS_EQUAL_TO": "equal",
        "DOES_NOT_EQUAL": "notEqual",
        "IS_GREATER_THAN": "greaterThan",
        "IS_GREATER_THAN_OR_EQUAL_TO": "greaterThanEqual",
        "IS_LESS_THAN": "lessThan",
        "IS_LESS_THAN_OR_EQUAL": "lessThanEqual",
        "INCLUDES_THE_VALUES": "includesTheValues",
        "INCLUDES_ANY": "includesAny",
        "DOES_NOT_INCLUDE_ANY": "doesNotIncludeAny",
        "DOES_NOT_INCLUDE_THE_VALUES": "doesNotIncludeTheValues",
        "SPECIFIC_VALUE": "specificValue",
        "NETWORK_ATTRIBUTE": "networkAttribute"
      }
      if(list.hasOwnProperty(param)) {
        return list[param];
      } else {
        return param;
      }
    }

/*
        stringSigArr[0];  //UN service
        stringSigArr[1];  //trace type
        stringSigArr[2];  //starting points GDB
        stringSigArr[3];  //Barriers GDB
        stringSigArr[4];  //Domain network
        stringSigArr[5];  //Tier
        stringSigArr[6];  //Target Tier
        stringSigArr[7];  //Subnetwork Name
        stringSigArr[8];  //shortest path network Attribute
        stringSigArr[9];  //include containers
        stringSigArr[10];  //include content
        stringSigArr[11];  //include structures
        stringSigArr[12];  //include barriers
        stringSigArr[13];  //validate consistency
        stringSigArr[14];  //Condition barriers
        stringSigArr[15];  //Function Barriers
        stringSigArr[16];  //Apply Traverse to
        stringSigArr[17];  //Filter Barriers
        stringSigArr[18];  //Filter function barriers
        stringSigArr[19];  //Apply Filter To
        stringSigArr[20];  //Filter by bitset NA
        stringSigArr[21];  //Filter By Nearest (KNN)
        stringSigArr[22];  //KNN Count
        stringSigArr[23];  //Cost Network Attribute
        stringSigArr[24];  //Nearest Categories
        stringSigArr[25];  //Nearest Asset Groups/Types
        stringSigArr[26];  //Functions
        stringSigArr[27];  //Propagators
        stringSigArr[28];  //Output Asset Types
        stringSigArr[29];  //Output Conditions
        stringSigArr[30];  //Output Utility Network


*/

  });
});