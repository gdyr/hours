angular.module('hours', ['angularMoment'])

  .run(function($rootScope, Calendar) {

    $rootScope.day = moment().startOf('day');
    $rootScope.entry = { text: '' };

    $rootScope.save = function() {
      var day = moment($rootScope.edit_day).format('YYYY-MM-DD');
      $.modal.close();
      for(var i = $rootScope.start_time; i < $rootScope.end_time; i++) {
        Calendar.add(day, i, $rootScope.entry.text == '' ? null : $rootScope.entry.text);
      }
      $rootScope.$broadcast('refresh');
    }

    $rootScope.export = function() {
      Calendar.export();
    }

  })

  .service('Calendar', function($window, $filter) {

    if(!$window.localStorage.calendar) { $window.localStorage.calendar = JSON.stringify({}); }
    var days = JSON.parse($window.localStorage.calendar);
    function save() { $window.localStorage.calendar = angular.toJson(days); }

    return {
      add: function(day, hour, text) {
        if(!days[day]) { days[day] = []; }
        days[day][hour] = {text: text};
        save();
      },
      get: function(day) {
        return days[day];
      },
      export: function() {
        var data = days;

        var csv = '';
        csv += 'Date,Start,End,Comment\r\n';

        var rows = [];
        for(var d in days) {
          for(var i = 0; i < 48; i++) {
            if(!days[d][i]) { continue; }
            if(days[d][i-1] && days[d][i-1].text == days[d][i].text) { rows[rows.length-1].end = $filter('timeOffset')(i+1); continue; }
            rows.push({
              date: d,
              start: $filter('timeOffset')(i),
              end: $filter('timeOffset')(i+1),
              text: days[d][i].text
            });
          }
        }

        for(var i in rows) {
          csv += rows[i].date + ',' + rows[i].start + ',' + rows[i].end + ',' + '"' + rows[i].text.replace(/"/g,'""') + '"\r\n';
        }

        var uri = 'data:text/csv;charset=utf-8,' + escape(csv);
        var link = document.createElement("a");    
        link.href = uri;
        link.style = "visibility:hidden";
        link.download = "hours.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      }
    }
  })

  .directive('dref', function() {
    return {
      restrict: 'A',
      controller: function($rootScope, $element) {
        $element.css('cursor', 'pointer');
        $element.click(function() {
          $rootScope.$apply(function() {
            $rootScope.day.add($element.attr('dref'), 'days');
          });
        })
      }
    }
  })

  .filter('dayShift', function() {
    return function(day, shift) {
      return moment(day).add(shift, 'days');
    }
  })

  .filter('dateFormat', function() {
    return function(day) {
      return day ? day.format('ddd DD/MM/YY') : '';
    }
  })

  .filter('timeOffset', function() {
    return function(offset) {
      return moment().startOf('day').add(offset*30, 'minutes').format('H:mm')
    }
  })

  .directive('dayEditor', function() {
    return {
      restrict: 'E',
      scope: true,
      template: `
        <div style="width: 200px; display: inline-block;">
          <h3>{{day | amAdd:offset:'days' | dateFormat}}</h3>
          <br />
          <div class="scrollarea" style="overflow-y: scroll; height: 588px; border-top: 1px solid gray; border-bottom: 1px solid gray;">
            <div class="timecell" ng-repeat="event in hours track by $index" offset="{{$index}}" ng-class="{event: event !== undefined}">
              <div class="label">{{$index | timeOffset}}</div>
              <div class="event">{{hours[$index].text}}</div>
            </div>
          </div>
        </div>
      `,
      controller: function($rootScope, $scope, $element, Calendar, $timeout) {

        $timeout(function() {
          $element.find('.scrollarea').scrollTop(465);
        });

        $scope.offset = $element.attr('offset');

        function refresh() {
          console.log('refresh!');
          var calendar = Calendar.get(moment($scope.day).add($scope.offset, 'days').format('YYYY-MM-DD'));
          $scope.hours = Array(48);
          for(var i = 0; i < 48; i++) {
            if(!calendar || !calendar[i]) { continue; }
            if(calendar[i-1] && calendar[i].text == calendar[i-1].text) { $scope.hours[i] = ''; }
            else {$scope.hours[i] = calendar[i]; }
          }
        }

        refresh();

        $scope.$watch('day', refresh, true);
        $scope.$on('refresh', refresh);

        var dragger;
        $element.on('mousedown mouseup mousemove mouseleave', function(e) {
          
          var cell = $(e.target);
          if(!cell.hasClass('timecell')) { return; }

          if(e.type == 'mousemove' && !dragger) { return; }

          if(e.type == 'mousedown') {
            dragger = cell;
          }

          if(!dragger) { return; }

          if(e.type == 'mouseleave') {
            dragger.parent().children().removeClass('highlight');
            dragger = false;
            return;
          }

          var start = Math.min(...[cell.index(),dragger.index()]);
          var end = Math.max(...[cell.index(),dragger.index()]);

          if(e.type == 'mouseup') {

            var start = parseInt(dragger.attr("offset"), 10);
            var end = parseInt(cell.attr("offset"), 10)+1;

            if(end < start) {
              var t = end;
              end = start;
              start = t;
            }

            $scope.$apply(function() {
              $rootScope.start_time = start;
              $rootScope.end_time = end;
              $rootScope.edit_day = moment($scope.day).add($scope.offset, 'days');
              $rootScope.entry.text = '';
            });

            $('#editModal').modal({ fadeDuration: 250 });
            dragger.parent().children().removeClass('highlight');
            dragger = false;
            return;
          }

          var selected = cell.parent().children().slice(start, end).add(cell).add(dragger);
          var deselected = cell.parent().children().not(selected);

          selected.addClass('highlight');
          deselected.removeClass('highlight');

        });
      }
    }
  })