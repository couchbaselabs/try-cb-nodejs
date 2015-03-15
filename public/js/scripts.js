
//// ▶▶ Angular ◀◀ ////
var testapp = angular.module('testApp', ['ui.bootstrap']);
testapp.controller('flightController',function($scope,$http){
    $scope.empty=true;
    $scope.rowCollection=[];
    $scope.findAirports=function(val){
        return $http.get("http://127.0.0.1:3000/api/airport/findAll",{
            params:{search:val}
        }).then(function(response){
            return response.data;
        });

    }
    $scope.findFlights=function(){
        $scope.empty=true;
        $scope.rowCollection=[];
        return $http.get("http://127.0.0.1:3000/api/flightPath/findAll",{
            params:{from:this.fromName,to:this.toName,leave:this.leave,ret:this.ret}
        }).then(function(response){
            if(response.data.length>0){
                $scope.empty=false;
            }
            for(var j=0;j<response.data.length;j++){
                $scope.rowCollection.push(response.data[j]);
            }
        });
    }
    $scope.dbg=function(){
        alert("DEBUG:"+ this.fromName +"::"+ this.toName +"::"+ this.leave +"::"+ this.ret);
    }
});

//// ▶▶ Jquery ◀◀ ////
var roundtrip = true;
$(function () {
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
        }else{
            $("#retDate").show();
            $("#retSpan").show();
            $("#retLabel").html("Round Trip");
        }
    });
});