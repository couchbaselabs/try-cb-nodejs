
//// ▶▶ Angular ◀◀ ////
var testapp = angular.module('testApp', ['ui.bootstrap']);
testapp.controller('flightController',function($scope,$http){
    $scope.empty=true;
    $scope.retEmpty=true;
    $scope.rowCollectionLeave=[];
    $scope.rowCollectionRet=[];
    $scope.findAirports=function(val){
        return $http.get("http://127.0.0.1:3000/api/airport/findAll",{
            params:{search:val}
        }).then(function(response){
            return response.data;
        });

    }
    $scope.findFlights = function () {
        $scope.empty = true;
        $scope.rowCollectionLeave = [];
        $scope.rowCollectionRet = [];
        $http.get("http://127.0.0.1:3000/api/flightPath/findAll", {
            params: {from: this.fromName, to: this.toName, leave: this.leave}
        }).then(function (response) {
            if (response.data.length > 0) {
                $scope.empty = false;
            }
            for (var j = 0; j < response.data.length; j++) {
                $scope.rowCollectionLeave.push(response.data[j]);
            }
        });
        if (this.ret) {
            $http.get("http://127.0.0.1:3000/api/flightPath/findAll", {
                params: {from: this.toName, to: this.fromName, leave: this.ret}
            }).then(function (responseRet) {
                if (responseRet.data.length > 0) {
                    console.log(JSON.stringify(responseRet.data));
                    $scope.retEmpty = false;
                }
                for (var j = 0; j < responseRet.data.length; j++) {
                    $scope.rowCollectionRet.push(responseRet.data[j]);
                }
            });
        }
    }
    $scope.dbg=function(){
        alert("DEBUG:"+ this.fromName +"::"+ this.toName +"::"+ this.leave +"::"+ this.ret);
    }

    //// ▶▶ Jquery inside Angular ◀◀ ////
    $('.input-daterange').datepicker({"todayHighlight": true, "autoclose":true});

    $("input.switch").bootstrapSwitch({
                                          onText: '⇄',
                                          offText: '→',
                                          size: 'mini',
                                          state: true
                                      });
    $("input.switch").on('switchChange.bootstrapSwitch', function (event, state) {
        if(!state){
            $("#retDate").hide();
            $("#retSpan").hide();
            $("#retLabel").html("One Way");
            $scope.retEmpty=true;
            $scope.$apply();
        }else{
            $("#retDate").show();
            $("#retSpan").show();
            $("#retLabel").html("Round Trip");
            $scope.retEmpty=false;
            $scope.$apply();
        }
    });
});


