(function(){
  'use strict';
  function reveal(){var id;try{id=decodeURIComponent(location.hash.slice(1));}catch(e){return;}var el=document.getElementById(id);if(el&&el.matches('details.wan-detail'))el.open=true;}
  reveal();window.addEventListener('hashchange',reveal);
  var search=document.getElementById('guide-search'),results=document.getElementById('guide-results');
  if(!search||!results)return;
  search.addEventListener('input',function(){
    var q=search.value.trim().toLowerCase();if(!q)return;
    var hits=(window.WANOYADO_PLACES||[]).filter(function(p){return (p.title+' '+p.search).toLowerCase().includes(q);});
    if(!hits.length)return;
    if(!results.querySelector('a'))results.textContent='';
    hits.forEach(function(p){var li=document.createElement('li'),a=document.createElement('a');a.href=p.url;a.textContent='Near WANOYADO · '+p.title;li.appendChild(a);results.appendChild(li);});
  });
})();
