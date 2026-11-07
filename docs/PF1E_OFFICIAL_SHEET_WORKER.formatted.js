(()=> {
  var e= {
    937(e) {
      function t(e) {
        return t="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e) {
          return typeof e
        }
        :function(e) {
          return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e
        }
        ,t(e)
      }
      var a=a||function() {
        "use strict";
        var e= {
          key:"error",title:"Error",color: {
            bgLabel:"#C11713",label:"white",bgText:"#C11713",text:"white"
          }
          
        }
        ,a= {
          key:"warn",title:"Warning",color: {
            bgLabel:"#F29140",label:"white",bgText:"#FFD8B7",text:"black"
          }
          
        }
        ,n= {
          key:"info",title:"Info",color: {
            bgLabel:"#413FA9",label:"white",bgText:"#B3B2EB",text:"black"
          }
          
        }
        ,r= {
          key:"notice",title:"Notice",color: {
            bgLabel:"#33C133",label:"white",bgText:"#ADF1AD",text:"black"
          }
          
        }
        ,i= {
          key:"log",title:"Log",color: {
            bgLabel:"#f2f240",label:"black",bgText:"#ffff90",text:"black"
          }
          
        }
        ,s= {
          key:"TAS",title:"function",color: {
            bgLabel:"#413FA9",label:"white",bgText:"#B3B2EB",text:"black"
          }
          
        }
        ,c= {
          key:"TAS",title:"ASYNC CALL",color: {
            bgLabel:"#413FA9",label:"white",bgText:"#413FA9",text:"white"
          }
          
        }
        ,o= {
          key:"TAS",title:"TAS",color: {
            bgLabel:"grey",label:"black;background:linear-gradient(#304352,#d7d2cc,#d7d2cc,#d7d2cc,#304352)",bgText:"grey",text:"black;background:linear-gradient(#304352,#d7d2cc,#d7d2cc,#d7d2cc,#304352)"
          }
          
        }
        ,l= {
          debugMode:!1,logging: {
            log:!0,notice:!0,info:!0,warn:!0,error:!0,debug:!1
          }
          
        }
        ,u=[],p= {
          
        }
        ,d=function(e,a,n) {
          _.each(n,(function(n) {
            var r=function(e) {
              switch(t(e)) {
                case"string":return"string";
                case"boolean":return"boolean";
                case"number":return _.isNaN(e)?"NaN":e.toString().match(/\./)?"decimal":"integer";
                case"function":return"function: "+(e.name?e.name+"()":"(anonymous)");
                case"object":return _.isArray(e)?"array":_.isArguments(e)?"arguments":_.isNull(e)?"null":"object";
                default:return t(e)
              }
              
            }
            (n);
            switch(r) {
              case"string":e(n);
              break;
              case"undefined":case"null":case"NaN":e("["+r+"]");
              break;
              case"number":case"not a number":case"integer":case"decimal":case"boolean":e("["+r+"]: "+n);
              break;
              default:e("["+r+"]:========================================="),a(n),e("=========================================================")
            }
            
          }
          ))
        }
        ,f=function(e) {
          var t,a=e.key,n=e.title||"TAS",r=e.color&&e.color.bgLabel||"blue",i=e.color&&e.color.label||"white",s=e.color&&e.color.bgText||"blue",c=e.color&&e.color.text||"white";
          return t=function(e) {
            console.log("%c "+n+": %c "+e+" ","background-color: "+r+";color: "+i+"; font-weight:bold;","background-color: "+s+";color: "+c+";")
          }
          ,function() {
            ("TAS"===a||l.logging[a])&&d(t,(function(e) {
              console.log(e)
            }
            ),_.toArray(arguments))
          }
          
        }
        ,m=f( {
          key:"debug",title:"DEBUG",color: {
            bgLabel:"#7732A2",label:"#F2EF40",bgText:"#FFFEB7",text:"#7732A2"
          }
          
        }
        ),g=f(e),b=f(a),h=f(n),y=f(r),v=f(i),k=f(o),w=f(s),A=f(c),C=function() {
          var e=new Error("dummy");
          return _.map(_.rest(e.stack.replace(/^[^(]+?[\n$]/gm,"").replace(/^\s+at\s+/gm,"").replace(/^Object.<anonymous>\s*\(/gm,"{anonymous}()@").split("\n")),(function(e) {
            return e.replace(/\s+.*$/,"")
          }
          ))
        }
        ,I=function(e) {
          var t,a;
          _.find(e,(function(e) {
            return(t=e.match(/TAS_CALLSTACK_(\d+)/))?(a=u[t[1]],A("===================="+(a.label?"> "+a.label+" <":"")+"===================="),I(a.stack),!0):(w(e),!1)
          }
          ))
        }
        ,x=function(e,t,a) {
          var n,r,i;
          return"function"==typeof e&&(a=t,t=e,e=void 0),l.debugMode?((n=C()).shift(),function(e,t,a,n) {
            var r=function(e,t) {
              var a=_.findIndex(u,(function(a) {
                return _.difference(a.stack,e).length===_.difference(e,a.stack).length&&0===_.difference(a.stack,e).length&&a.label===t
              }
              ));
              return-1===a&&(a=u.length,u.push( {
                stack:e,label:t
              }
              )),a
            }
            (a,n);
            return new Function("cb","ctx","TASlog","return function TAS_CALLSTACK_"+r+"(){var start,end;TASlog('Entering: '+(cb.name||'(anonymous function)'));start=_.now();cb.apply(ctx||{},arguments);end=_.now();TASlog('Exiting: '+(cb.name||'(anonymous function)')+' :: '+(end-start)+'ms elapsed');};")(e,t,k)
          }
          (t,a,n,e)):(r=t,i=a,function() {
            r.apply(i|| {
              
            }
            ,arguments)
          }
          )
        }
        ,P=function(e,t) {
          p[e]=t
        }
        ,S=function(e,t) {
          return _.chain(e).reduce((function(t,a) {
            return"string"==typeof a?t.push(a):(_.isArray(e)||_.isArguments(e))&&(t=S(a,t)),t
          }
          ),_.isArray(t)&&t||[]).uniq().value()
        }
        ,T=function(e,t,a,n) {
          var r,i,s;
          r=_.contains(["S","F","I","D"],t)?"_"+t:t,i=n||t,s=a,_.each(["S","I","F"],(function(t) {
            _.has(e,t)||Object.defineProperty(e,t, {
              value: {
                
              }
              ,enumerable:!1,readonly:!0
            }
            )
          }
          )),_.has(e,"D")||Object.defineProperty(e,"D", {
            value:_.reduce(_.range(10),(function(e,t) {
              return Object.defineProperty(e,t, {
                value: {
                  
                }
                ,enumerable:!0,readonly:!0
              }
              ),e
            }
            ), {
              
            }
            ),enumerable:!1,readonly:!0
          }
          ),Object.defineProperty(e,r, {
            enumerable:!0,set:function(e) {
              e!==s&&(s=e,P(i,e))
            }
            ,get:function() {
              return s
            }
            
          }
          ),Object.defineProperty(e.S,r, {
            enumerable:!0,set:function(e) {
              var t=e.toString();
              t!==s&&(s=t,P(i,t))
            }
            ,get:function() {
              return s.toString()
            }
            
          }
          ),Object.defineProperty(e.I,r, {
            enumerable:!0,set:function(e) {
              var t=parseInt(e,10)||0;
              t!==s&&(s=t,P(i,t))
            }
            ,get:function() {
              return parseInt(s,10)||0
            }
            
          }
          ),Object.defineProperty(e.F,r, {
            enumerable:!0,set:function(e) {
              var t=parseFloat(e)||0;
              t!==s&&(s=t,P(i,t))
            }
            ,get:function() {
              return parseFloat(s)||0
            }
            
          }
          ),_.each(_.range(10),(function(t) {
            Object.defineProperty(e.D[t],r, {
              enumerable:!0,set:function(e) {
                var a=(parseFloat(e)||0).toFixed(t);
                a!==s&&(s=a,P(i,a))
              }
              ,get:function() {
                return(parseFloat(s)||0).toFixed(t)
              }
              
            }
            )
          }
          ))
        }
        ,E=function(e) {
          return t=e,a=[],n=[],r=[],i=[],s=function() {
            return a=S(arguments,a),this
          }
          ,c=function() {
            return n=S(arguments,n),this
          }
          ,m=function(e,s) {
            var c= {
              
            }
            ,o= {
              
            }
            ,l=[],u=[];
            f(e,s),getSectionIDs("repeating_"+t,(function(e) {
              l=e,u=_.reduce(l,(function(e,a) {
                return e.concat(_.map(n,(function(e) {
                  return"repeating_"+t+"_"+a+"_"+e
                }
                )))
              }
              ),[]),getAttrs(_.uniq(a.concat(u)),(function(e) {
                _.each(a,(function(t) {
                  e.hasOwnProperty(t)&&T(o,t,e[t])
                }
                )),c=_.reduce(l,(function(a,r) {
                  var i,s,c= {
                    
                  }
                  ;
                  return i=c,s=r,Object.defineProperty(i,"id", {
                    value:s,writable:!1,enumerable:!1
                  }
                  ),_.each(n,(function(a) {
                    var n="repeating_"+t+"_"+r+"_"+a;
                    T(c,a,e[n],n)
                  }
                  )),a[r]=c,a
                }
                ), {
                  
                }
                ),_.each(r,(function(e) {
                  var t;
                  switch(e.type) {
                    case"tap":_.bind(e.final,e.context,c,o)();
                    break;
                    case"each":_.each(c,(function(t) {
                      _.bind(e.func,e.context,t,o,t.id,c)()
                    }
                    )),_.bind(e.final,e.context,c,o)();
                    break;
                    case"map":t=_.map(c,(function(t) {
                      return _.bind(e.func,e.context,t,o,t.id,c)()
                    }
                    )),_.bind(e.final,e.context,t,c,o)();
                    break;
                    case"reduce":t=e.memo,_.each(c,(function(a) {
                      t=_.bind(e.func,e.context,t,a,o,a.id,c)()
                    }
                    )),_.bind(e.final,e.context,t,c,o)()
                  }
                  
                }
                )),setAttrs(p),p= {
                  
                }
                ,_.each(i,(function(e) {
                  _.bind(e.callback,e.context)()
                }
                ))
              }
              ))
            }
            ))
          }
          , {
            attrs:s,attr:s,column:c,columns:c,field:c,fields:c,reduce:o=function(e,t,a,n) {
              return r.push( {
                type:"reduce",func:e&&_.isFunction(e)&&e||_.noop,memo:(_.isUndefined(t),t),final:a&&_.isFunction(a)&&a||_.noop,context:n|| {
                  
                }
                
              }
              ),this
            }
            ,inject:o,foldl:o,map:l=function(e,t,a) {
              return r.push( {
                type:"map",func:e&&_.isFunction(e)&&e||_.noop,final:t&&_.isFunction(t)&&t||_.noop,context:a|| {
                  
                }
                
              }
              ),this
            }
            ,collect:l,each:u=function(e,t,a) {
              return r.push( {
                type:"each",func:e&&_.isFunction(e)&&e||_.noop,final:t&&_.isFunction(t)&&t||_.noop,context:a|| {
                  
                }
                
              }
              ),this
            }
            ,forEach:u,tap:d=function(e,t) {
              return r.push( {
                type:"tap",final:e&&_.isFunction(e)&&e||_.noop,context:t|| {
                  
                }
                
              }
              ),this
            }
            ,do:d,after:f=function(e,t) {
              return i.push( {
                callback:e&&_.isFunction(e)&&e||_.noop,context:t|| {
                  
                }
                
              }
              ),this
            }
            ,last:f,done:f,execute:m,go:m,run:m
          }
          ;
          var t,a,n,r,i,s,c,o,l,u,d,f,m
        }
        ;
        return console.log("%c•.¸¸.•*´¨`*•.¸¸.•*´¨`*•.¸¸.•*´¨`*•.¸ The Aaron Sheet  v0.2.5  ¸.•*´¨`*•.¸¸.•*´¨`*•.¸¸.•*´¨`*•.¸¸\n•.¸¸.•*´¨`*• Last update: "+new Date(1504710542e3)+"..•*´¨` *•.¸¸","background: linear-gradient(to right,green,white,white,green); color:black;text-shadow: 0 0 8px white;"), {
          repeatingSimpleSum:function(e,t,a) {
            E(e).attr(a).field(t).reduce((function(e,a) {
              return e+a.F[t]
            }
            ),0,(function(e,t,n) {
              n.S[a]=e
            }
            )).execute()
          }
          ,repeating:E,config:function(e) {
            var t=_.defaults(e,l);
            t.logging=_.defaults(e&&e.logging|| {
              
            }
            ,l.logging),l=t
          }
          ,callback:x,callstack:function() {
            var e;
            l.debugMode&&((e=C()).shift(),k("==============================> CALLSTACK <=============================="),I(e),k("========================================================================="))
          }
          ,debugMode:function() {
            l.logging.debug=!0,l.debugMode=!0
          }
          ,isDebugMode:function() {
            return l.debugMode
          }
          ,_fn:x,debug:m,error:g,warn:b,info:h,notice:y,log:v
        }
        
      }
      ();
      e.exports=a
    }
    
  }
  ,t= {
    
  }
  ;
  function a(n) {
    var r=t[n];
    if(void 0!==r)return r.exports;
    var i=t[n]= {
      exports: {
        
      }
      
    }
    ;
    return e[n](i,i.exports,a),i.exports
  }
  a.n=e=> {
    var t=e&&e.__esModule?()=>e.default:()=>e;
    return a.d(t, {
      a:t
    }
    ),t
  }
  ,a.d=(e,t)=> {
    for(var n in t)a.o(t,n)&&!a.o(e,n)&&Object.defineProperty(e,n, {
      enumerable:!0,get:t[n]
    }
    )
  }
  ,a.g=function() {
    if("object"==typeof globalThis)return globalThis;
    try {
      return this||new Function("return this")()
    }
    catch(e) {
      if("object"==typeof window)return window
    }
    
  }
  (),a.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),a.r=e=> {
    "undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag, {
      value:"Module"
    }
    ),Object.defineProperty(e,"__esModule", {
      value:!0
    }
    )
  }
  ,(()=> {
    "use strict";
    var e= {
      
    }
    ;
    a.r(e),a.d(e, {
      VERSION:()=>l,after:()=>qt,all:()=>ia,allKeys:()=>ke,any:()=>sa,assign:()=>qe,before:()=>Ht,bind:()=>Pt,bindAll:()=>Et,chain:()=>At,chunk:()=>Ua,clone:()=>je,collect:()=>Qt,compact:()=>Da,compose:()=>Ot,constant:()=>ne,contains:()=>ca,countBy:()=>ka,create:()=>Ue,debounce:()=>Rt,default:()=>Ga,defaults:()=>He,defer:()=>Ft,delay:()=>Mt,detect:()=>Yt,difference:()=>Fa,drop:()=>Ta,each:()=>Jt,escape:()=>pt,every:()=>ia,extend:()=>Oe,extendOwn:()=>qe,filter:()=>na,find:()=>Yt,findIndex:()=>Wt,findKey:()=>Ut,findLastIndex:()=>Gt,findWhere:()=>Zt,first:()=>Sa,flatten:()=>Ma,foldl:()=>ta,foldr:()=>aa,forEach:()=>Jt,functions:()=>ze,get:()=>$e,groupBy:()=>ya,has:()=>Ke,head:()=>Sa,identity:()=>Ye,include:()=>ca,includes:()=>ca,indexBy:()=>va,indexOf:()=>$t,initial:()=>Pa,inject:()=>ta,intersection:()=>La,invert:()=>Re,invoke:()=>oa,isArguments:()=>ee,isArray:()=>Z,isArrayBuffer:()=>U,isBoolean:()=>F,isDataView:()=>Y,isDate:()=>O,isElement:()=>N,isEmpty:()=>fe,isEqual:()=>ve,isError:()=>H,isFinite:()=>te,isFunction:()=>G,isMap:()=>Te,isMatch:()=>me,isNaN:()=>ae,isNull:()=>D,isNumber:()=>L,isObject:()=>E,isRegExp:()=>q,isSet:()=>De,isString:()=>z,isSymbol:()=>B,isTypedArray:()=>le,isUndefined:()=>M,isWeakMap:()=>Ee,isWeakSet:()=>Me,iteratee:()=>tt,keys:()=>de,last:()=>Ea,lastIndexOf:()=>Kt,map:()=>Qt,mapObject:()=>nt,matcher:()=>Ze,matches:()=>Ze,max:()=>pa,memoize:()=>Dt,methods:()=>ze,min:()=>da,mixin:()=>Wa,negate:()=>Lt,noop:()=>rt,now:()=>ot,object:()=>Ha,omit:()=>xa,once:()=>Bt,pairs:()=>Ne,partial:()=>xt,partition:()=>wa,pick:()=>Ia,pluck:()=>la,property:()=>Je,propertyOf:()=>it,random:()=>ct,range:()=>Ba,reduce:()=>ta,reduceRight:()=>aa,reject:()=>ra,rest:()=>Ta,restArguments:()=>T,result:()=>vt,sample:()=>_a,select:()=>na,shuffle:()=>ga,size:()=>Aa,some:()=>sa,sortBy:()=>ba,sortedIndex:()=>Xt,tail:()=>Ta,take:()=>Sa,tap:()=>We,template:()=>yt,templateSettings:()=>ft,throttle:()=>Nt,times:()=>st,toArray:()=>ma,toPath:()=>Ge,transpose:()=>Oa,unescape:()=>dt,union:()=>za,uniq:()=>Ra,unique:()=>Ra,uniqueId:()=>wt,unzip:()=>Oa,values:()=>Fe,where:()=>ua,without:()=>Na,wrap:()=>zt,zip:()=>qa
    }
    );
    var t=a(937),n=a.n(t),r="%cס§₪₪₪₪§|(Ξ≥≤≥≤≥≤ΞΞΞΞΞΞΞΞΞΞ>    ",i="    <ΞΞΞΞΞΞΞΞΞΞ≥≤≥≤≥≤Ξ)|§₪₪₪₪§ס",s="background: linear-gradient(to right,green,white,white,green); color:black;text-shadow: 0 0 8px white;",c=function(e) {
      console.log(r+e+i,s)
    }
    ;
    const o= {
      version:1.83,announcementVersionAttr:"attentionv172-show",repeatingSections:["weapon","ability","class-ability","feat","racial-trait","trait","item","npc-spell-like-abilities","mythic-ability","mythic-feat","buff","spells","buff2"],repeatingMaxUseSections:["class-ability","feat","racial-trait","trait","mythic-ability","mythic-feat","ability"],abilityScoreManualDropdowns: {
        "HP-ability":"HP-ability-mod","init-ability":"init-ability-mod","Fort-ability":"Fort-ability-mod","Ref-ability":"Ref-ability-mod","Will-ability":"Will-ability-mod","melee-ability":"melee-ability-mod","melee2-ability":"melee2-ability-mod","ranged-ability":"ranged-ability-mod","ranged2-ability":"ranged2-ability-mod","CMB-ability":"CMB-ability-mod","CMB2-ability":"CMB2-ability-mod","sanity-ability":"sanity-ability-mod","concentration-0-ability":"concentration-0-mod","concentration-1-ability":"concentration-1-mod","concentration-2-ability":"concentration-2-mod","AC-ability":"AC-ability-mod","FF-ability":"FF-DEX","CMD-ability":"FF-CMD","CMD-ability1":"CMD-STR","CMD-ability2":"CMD-DEX","selected-ability-psionic-power":"ability-psionic-power",kineticist_ability:"kineticist_ability-mod"
      }
      ,levelPlusBABManualDropdowns:["melee_bab","melee2_bab","ranged_bab","ranged2_bab","cmb_bab","cmb2_bab","kineticist_level"],manualDropdownDefaults: {
        "HP-ability":"CON-mod","init-ability":"DEX-mod","Fort-ability":"CON-mod","Ref-ability":"DEX-mod","Will-ability":"WIS-mod","melee-ability":"STR-mod","melee2-ability":"0","ranged-ability":"DEX-mod","ranged2-ability":"0",melee_bab:"bab",melee2_bab:"bab",ranged_bab:"bab",ranged2_bab:"bab",cmb_bab:"bab",cmb2_bab:"bab","sanity-ability":"0","concentration-0-ability":"0","concentration-1-ability":"0","concentration-2-ability":"0","AC-ability":"DEX-mod","FF-ability":"0","CMD-ability":"0","CMD-ability1":"STR-mod","CMD-ability2":"DEX-mod","selected-ability-psionic-power":"0",kineticist_ability:"CON-mod"
      }
      ,repeatingAttackTypeManualDropdowns: {
        weapon:"attack-type",item:"item-attack-type",spells:"spell-attack-type",ability:"abil-attack-type"
      }
      ,equationMacros: {
        "init-misc":"init-misc-mod","HP-formula-macro-text":"HP-formula-mod","death_threshold-macro-text":"death_threshold_total","Max-Skill-Ranks-Misc":"Max-Skill-Ranks-mod","SR-macro-text":"SR","spellclass-0-SP_misc":"spellclass-0-SP-mod","spellclass-1-SP_misc":"spellclass-1-SP-mod","spellclass-2-SP_misc":"spellclass-2-SP-mod",sanity_score_misc:"sanity_score_misc-mod",sanity_threshold_misc:"sanity_threshold_misc-mod","spellclass-0-level-misc":"spellclass-0-level-misc-mod","spellclass-1-level-misc":"spellclass-1-level-misc-mod","spellclass-2-level-misc":"spellclass-2-level-misc-mod","Concentration-0-misc":"Concentration-0-misc-mod","Concentration-1-misc":"Concentration-1-misc-mod","Concentration-2-misc":"Concentration-2-misc-mod","Ref-misc":"Ref-misc-mod","Fort-misc":"Fort-misc-mod","Will-misc":"Will-misc-mod","AC-misc":"AC-misc-mod","CMD-misc":"CMD-misc-mod","attk-melee-misc":"attk-melee-misc-mod","attk-ranged-misc":"attk-ranged-misc-mod","attk-CMB-misc":"attk-CMB-misc-mod","attk-melee2-misc":"attk-melee2-misc-mod","attk-ranged2-misc":"attk-ranged2-misc-mod","attk-CMB2-misc":"attk-CMB2-misc-mod",kineticistburn_macro_text:"kineticistburn_max",internalbuffer_macro_text:"internalbuffer_max",kineticblast_attack_macro_text:"kineticblast_attack-mod",kineticblast_dmg_macro_text:"kineticblast_dmg-mod","spellclass-0-spell-points-misc":"spellclass-0-spell-points-misc-mod","spellclass-1-spell-points-misc":"spellclass-1-spell-points-misc-mod","spellclass-2-spell-points-misc":"spellclass-2-spell-points-misc-mod"
      }
      ,customEquationMacros: {
        customa1:"customa1-mod",customa2:"customa2-mod",customa3:"customa3-mod",customa4:"customa4-mod_max",customa5:"customa5-mod_max",customa6:"customa6-mod_max",customa7:"customa7-mod_max",customa8:"customa8-mod_max",customa9:"customa9-mod_max",customa10:"customa10-mod",customa11:"customa11-mod",customa12:"customa12-mod","customa4-mod":"0","customa5-mod":"0","customa6-mod":"0","customa7-mod":"0","customa8-mod":"0","customa9-mod":"0"
      }
      ,spellClassIndexes:["0","1","2"],silentParams: {
        silent:!0
      }
      ,minusreg:/\-|&Mdash;
      |&\#8212;
      |\u2013|\u2014|\u2212|\u02d7/,dashtominusreg:/&Mdash;
      |&\#8212;
      |\u2013|\u2014|\u2212|\u02d7/g,critreg:/\/ {
        0,1
      }
      (\d+)\-20(?:[x\u00d7](\d+)) {
        0,1
      }
      /,critmultreg:/(?:\/[x\u00d7]|\/|[x\u00d7])(\d+)/,diceDiereg:/(\d+)d(\d+)\s*(?:([\+|\-])(\d+)) {
        0,1
      }
      /,diceDieregOneGroup:/(\d+d\d+\s*(?:[\+|\-|\u2013|\u2014|\u2212|\u02d7]\d+) {
        0,1
      }
      )/g,findBadNegDice:/(\d+)d(2|3|4|6|8|10|12|20)([1-9]+)/g,findBadCritRange:/(19|18|17|16|15|14|13|12)20/g
    }
    ;
    var l="1.13.7",u="object"==typeof self&&self.self===self&&self||"object"==typeof a.g&&a.g.global===a.g&&a.g||Function("return this")()|| {
      
    }
    ,p=Array.prototype,d=Object.prototype,f="undefined"!=typeof Symbol?Symbol.prototype:null,m=p.push,_=p.slice,g=d.toString,b=d.hasOwnProperty,h="undefined"!=typeof ArrayBuffer,y="undefined"!=typeof DataView,v=Array.isArray,k=Object.keys,w=Object.create,A=h&&ArrayBuffer.isView,C=isNaN,I=isFinite,x=! {
      toString:null
    }
    .propertyIsEnumerable("toString"),P=["valueOf","isPrototypeOf","toString","propertyIsEnumerable","hasOwnProperty","toLocaleString"],S=Math.pow(2,53)-1;
    function T(e,t) {
      return t=null==t?e.length-1:+t,function() {
        for(var a=Math.max(arguments.length-t,0),n=Array(a),r=0;
        r<a;
        r++)n[r]=arguments[r+t];
        switch(t) {
          case 0:return e.call(this,n);
          case 1:return e.call(this,arguments[0],n);
          case 2:return e.call(this,arguments[0],arguments[1],n)
        }
        var i=Array(t+1);
        for(r=0;
        r<t;
        r++)i[r]=arguments[r];
        return i[t]=n,e.apply(this,i)
      }
      
    }
    function E(e) {
      var t=typeof e;
      return"function"===t||"object"===t&&!!e
    }
    function D(e) {
      return null===e
    }
    function M(e) {
      return void 0===e
    }
    function F(e) {
      return!0===e||!1===e||"[object Boolean]"===g.call(e)
    }
    function N(e) {
      return!(!e||1!==e.nodeType)
    }
    function R(e) {
      var t="[object "+e+"]";
      return function(e) {
        return g.call(e)===t
      }
      
    }
    const z=R("String"),L=R("Number"),O=R("Date"),q=R("RegExp"),H=R("Error"),B=R("Symbol"),U=R("ArrayBuffer");
    var j=R("Function"),W=u.document&&u.document.childNodes;
    "object"!=typeof Int8Array&&"function"!=typeof W&&(j=function(e) {
      return"function"==typeof e||!1
    }
    );
    const G=j,X=R("Object");
    var V=y&&(!/\[native code\]/.test(String(DataView))||X(new DataView(new ArrayBuffer(8)))),$="undefined"!=typeof Map&&X(new Map),K=R("DataView");
    const Y=V?function(e) {
      return null!=e&&G(e.getInt8)&&U(e.buffer)
    }
    :K,Z=v||R("Array");
    function J(e,t) {
      return null!=e&&b.call(e,t)
    }
    var Q=R("Arguments");
    !function() {
      Q(arguments)||(Q=function(e) {
        return J(e,"callee")
      }
      )
    }
    ();
    const ee=Q;
    function te(e) {
      return!B(e)&&I(e)&&!isNaN(parseFloat(e))
    }
    function ae(e) {
      return L(e)&&C(e)
    }
    function ne(e) {
      return function() {
        return e
      }
      
    }
    function re(e) {
      return function(t) {
        var a=e(t);
        return"number"==typeof a&&a>=0&&a<=S
      }
      
    }
    function ie(e) {
      return function(t) {
        return null==t?void 0:t[e]
      }
      
    }
    const se=ie("byteLength"),ce=re(se);
    var oe=/\[object ((I|Ui)nt(8|16|32)|Float(32|64)|Uint8Clamped|Big(I|Ui)nt64)Array\]/;
    const le=h?function(e) {
      return A?A(e)&&!Y(e):ce(e)&&oe.test(g.call(e))
    }
    :ne(!1),ue=ie("length");
    function pe(e,t) {
      t=function(e) {
        for(var t= {
          
        }
        ,a=e.length,n=0;
        n<a;
        ++n)t[e[n]]=!0;
        return {
          contains:function(e) {
            return!0===t[e]
          }
          ,push:function(a) {
            return t[a]=!0,e.push(a)
          }
          
        }
        
      }
      (t);
      var a=P.length,n=e.constructor,r=G(n)&&n.prototype||d,i="constructor";
      for(J(e,i)&&!t.contains(i)&&t.push(i);
      a--;
      )(i=P[a])in e&&e[i]!==r[i]&&!t.contains(i)&&t.push(i)
    }
    function de(e) {
      if(!E(e))return[];
      if(k)return k(e);
      var t=[];
      for(var a in e)J(e,a)&&t.push(a);
      return x&&pe(e,t),t
    }
    function fe(e) {
      if(null==e)return!0;
      var t=ue(e);
      return"number"==typeof t&&(Z(e)||z(e)||ee(e))?0===t:0===ue(de(e))
    }
    function me(e,t) {
      var a=de(t),n=a.length;
      if(null==e)return!n;
      for(var r=Object(e),i=0;
      i<n;
      i++) {
        var s=a[i];
        if(t[s]!==r[s]||!(s in r))return!1
      }
      return!0
    }
    function _e(e) {
      return e instanceof _e?e:this instanceof _e?void(this._wrapped=e):new _e(e)
    }
    function ge(e) {
      return new Uint8Array(e.buffer||e,e.byteOffset||0,se(e))
    }
    _e.VERSION=l,_e.prototype.value=function() {
      return this._wrapped
    }
    ,_e.prototype.valueOf=_e.prototype.toJSON=_e.prototype.value,_e.prototype.toString=function() {
      return String(this._wrapped)
    }
    ;
    var be="[object DataView]";
    function he(e,t,a,n) {
      if(e===t)return 0!==e||1/e==1/t;
      if(null==e||null==t)return!1;
      if(e!=e)return t!=t;
      var r=typeof e;
      return("function"===r||"object"===r||"object"==typeof t)&&ye(e,t,a,n)
    }
    function ye(e,t,a,n) {
      e instanceof _e&&(e=e._wrapped),t instanceof _e&&(t=t._wrapped);
      var r=g.call(e);
      if(r!==g.call(t))return!1;
      if(V&&"[object Object]"==r&&Y(e)) {
        if(!Y(t))return!1;
        r=be
      }
      switch(r) {
        case"[object RegExp]":case"[object String]":return""+e==""+t;
        case"[object Number]":return+e!=+e?+t!=+t:0==+e?1/+e==1/t:+e==+t;
        case"[object Date]":case"[object Boolean]":return+e==+t;
        case"[object Symbol]":return f.valueOf.call(e)===f.valueOf.call(t);
        case"[object ArrayBuffer]":case be:return ye(ge(e),ge(t),a,n)
      }
      var i="[object Array]"===r;
      if(!i&&le(e)) {
        if(se(e)!==se(t))return!1;
        if(e.buffer===t.buffer&&e.byteOffset===t.byteOffset)return!0;
        i=!0
      }
      if(!i) {
        if("object"!=typeof e||"object"!=typeof t)return!1;
        var s=e.constructor,c=t.constructor;
        if(s!==c&&!(G(s)&&s instanceof s&&G(c)&&c instanceof c)&&"constructor"in e&&"constructor"in t)return!1
      }
      n=n||[];
      for(var o=(a=a||[]).length;
      o--;
      )if(a[o]===e)return n[o]===t;
      if(a.push(e),n.push(t),i) {
        if((o=e.length)!==t.length)return!1;
        for(;
        o--;
        )if(!he(e[o],t[o],a,n))return!1
      }
      else {
        var l,u=de(e);
        if(o=u.length,de(t).length!==o)return!1;
        for(;
        o--;
        )if(!J(t,l=u[o])||!he(e[l],t[l],a,n))return!1
      }
      return a.pop(),n.pop(),!0
    }
    function ve(e,t) {
      return he(e,t)
    }
    function ke(e) {
      if(!E(e))return[];
      var t=[];
      for(var a in e)t.push(a);
      return x&&pe(e,t),t
    }
    function we(e) {
      var t=ue(e);
      return function(a) {
        if(null==a)return!1;
        var n=ke(a);
        if(ue(n))return!1;
        for(var r=0;
        r<t;
        r++)if(!G(a[e[r]]))return!1;
        return e!==Pe||!G(a[Ae])
      }
      
    }
    var Ae="forEach",Ce=["clear","delete"],Ie=["get","has","set"],xe=Ce.concat(Ae,Ie),Pe=Ce.concat(Ie),Se=["add"].concat(Ce,Ae,"has");
    const Te=$?we(xe):R("Map"),Ee=$?we(Pe):R("WeakMap"),De=$?we(Se):R("Set"),Me=R("WeakSet");
    function Fe(e) {
      for(var t=de(e),a=t.length,n=Array(a),r=0;
      r<a;
      r++)n[r]=e[t[r]];
      return n
    }
    function Ne(e) {
      for(var t=de(e),a=t.length,n=Array(a),r=0;
      r<a;
      r++)n[r]=[t[r],e[t[r]]];
      return n
    }
    function Re(e) {
      for(var t= {
        
      }
      ,a=de(e),n=0,r=a.length;
      n<r;
      n++)t[e[a[n]]]=a[n];
      return t
    }
    function ze(e) {
      var t=[];
      for(var a in e)G(e[a])&&t.push(a);
      return t.sort()
    }
    function Le(e,t) {
      return function(a) {
        var n=arguments.length;
        if(t&&(a=Object(a)),n<2||null==a)return a;
        for(var r=1;
        r<n;
        r++)for(var i=arguments[r],s=e(i),c=s.length,o=0;
        o<c;
        o++) {
          var l=s[o];
          t&&void 0!==a[l]||(a[l]=i[l])
        }
        return a
      }
      
    }
    const Oe=Le(ke),qe=Le(de),He=Le(ke,!0);
    function Be(e) {
      if(!E(e))return {
        
      }
      ;
      if(w)return w(e);
      var t=function() {
        
      }
      ;
      t.prototype=e;
      var a=new t;
      return t.prototype=null,a
    }
    function Ue(e,t) {
      var a=Be(e);
      return t&&qe(a,t),a
    }
    function je(e) {
      return E(e)?Z(e)?e.slice():Oe( {
        
      }
      ,e):e
    }
    function We(e,t) {
      return t(e),e
    }
    function Ge(e) {
      return Z(e)?e:[e]
    }
    function Xe(e) {
      return _e.toPath(e)
    }
    function Ve(e,t) {
      for(var a=t.length,n=0;
      n<a;
      n++) {
        if(null==e)return;
        e=e[t[n]]
      }
      return a?e:void 0
    }
    function $e(e,t,a) {
      var n=Ve(e,Xe(t));
      return M(n)?a:n
    }
    function Ke(e,t) {
      for(var a=(t=Xe(t)).length,n=0;
      n<a;
      n++) {
        var r=t[n];
        if(!J(e,r))return!1;
        e=e[r]
      }
      return!!a
    }
    function Ye(e) {
      return e
    }
    function Ze(e) {
      return e=qe( {
        
      }
      ,e),function(t) {
        return me(t,e)
      }
      
    }
    function Je(e) {
      return e=Xe(e),function(t) {
        return Ve(t,e)
      }
      
    }
    function Qe(e,t,a) {
      if(void 0===t)return e;
      switch(null==a?3:a) {
        case 1:return function(a) {
          return e.call(t,a)
        }
        ;
        case 3:return function(a,n,r) {
          return e.call(t,a,n,r)
        }
        ;
        case 4:return function(a,n,r,i) {
          return e.call(t,a,n,r,i)
        }
        
      }
      return function() {
        return e.apply(t,arguments)
      }
      
    }
    function et(e,t,a) {
      return null==e?Ye:G(e)?Qe(e,t,a):E(e)&&!Z(e)?Ze(e):Je(e)
    }
    function tt(e,t) {
      return et(e,t,1/0)
    }
    function at(e,t,a) {
      return _e.iteratee!==tt?_e.iteratee(e,t):et(e,t,a)
    }
    function nt(e,t,a) {
      t=at(t,a);
      for(var n=de(e),r=n.length,i= {
        
      }
      ,s=0;
      s<r;
      s++) {
        var c=n[s];
        i[c]=t(e[c],c,e)
      }
      return i
    }
    function rt() {
      
    }
    function it(e) {
      return null==e?rt:function(t) {
        return $e(e,t)
      }
      
    }
    function st(e,t,a) {
      var n=Array(Math.max(0,e));
      t=Qe(t,a,1);
      for(var r=0;
      r<e;
      r++)n[r]=t(r);
      return n
    }
    function ct(e,t) {
      return null==t&&(t=e,e=0),e+Math.floor(Math.random()*(t-e+1))
    }
    _e.toPath=Ge,_e.iteratee=tt;
    const ot=Date.now||function() {
      return(new Date).getTime()
    }
    ;
    function lt(e) {
      var t=function(t) {
        return e[t]
      }
      ,a="(?:"+de(e).join("|")+")",n=RegExp(a),r=RegExp(a,"g");
      return function(e) {
        return e=null==e?"":""+e,n.test(e)?e.replace(r,t):e
      }
      
    }
    const ut= {
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","`":"&#x60;"
    }
    ,pt=lt(ut),dt=lt(Re(ut)),ft=_e.templateSettings= {
      evaluate:/<%([\s\S]+?)%>/g,interpolate:/<%=([\s\S]+?)%>/g,escape:/<%-([\s\S]+?)%>/g
    }
    ;
    var mt=/(.)^/,_t= {
      "'":"'","\\":"\\","\r":"r","\n":"n","\u2028":"u2028","\u2029":"u2029"
    }
    ,gt=/\\|'|\r|\n|\u2028|\u2029/g;function bt(e){return"\\"+_t[e]}var ht=/^\s*(\w|\$)+\s*$/;function yt(e,t,a){!t&&a&&(t=a),t=He({},t,_e.templateSettings);var n=RegExp([(t.escape||mt).source,(t.interpolate||mt).source,(t.evaluate||mt).source].join("|")+"|$","g"),r=0,i="__p+='";e.replace(n,(function(t,a,n,s,c){return i+=e.slice(r,c).replace(gt,bt),r=c+t.length,a?i+="'+\n((__t=("+a+"))==null?'':_.escape(__t))+\n'":n?i+="'+\n((__t=("+n+"))==null?'':__t)+\n'":s&&(i+="';\n"+s+"\n__p+='"),t})),i+="';\n";var s,c=t.variable;if(c){if(!ht.test(c))throw new Error("variable is not a bare identifier: "+c)}else i="with(obj||{}){\n"+i+"}\n",c="obj";i="var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};\n"+i+"return __p;\n";try{s=new Function(c,"_",i)}catch(e){throw e.source=i,e}var o=function(e){return s.call(this,e,_e)};return o.source="function("+c+"){\n"+i+"}",o}function vt(e,t,a){var n=(t=Xe(t)).length;if(!n)return G(a)?a.call(e):a;for(var r=0;r<n;r++){var i=null==e?void 0:e[t[r]];void 0===i&&(i=a,r=n),e=G(i)?i.call(e):i}return e}var kt=0;function wt(e){var t=++kt+"";return e?e+t:t}function At(e){var t=_e(e);return t._chain=!0,t}function Ct(e,t,a,n,r){if(!(n instanceof t))return e.apply(a,r);var i=Be(e.prototype),s=e.apply(i,r);return E(s)?s:i}var It=T((function(e,t){var a=It.placeholder,n=function(){for(var r=0,i=t.length,s=Array(i),c=0;c<i;c++)s[c]=t[c]===a?arguments[r++]:t[c];for(;r<arguments.length;)s.push(arguments[r++]);return Ct(e,n,this,this,s)};return n}));It.placeholder=_e;const xt=It,Pt=T((function(e,t,a){if(!G(e))throw new TypeError("Bind must be called on a function");var n=T((function(r){return Ct(e,n,t,this,a.concat(r))}));return n})),St=re(ue);function Tt(e,t,a,n){if(n=n||[],t||0===t){if(t<=0)return n.concat(e)}else t=1/0;for(var r=n.length,i=0,s=ue(e);i<s;i++){var c=e[i];if(St(c)&&(Z(c)||ee(c)))if(t>1)Tt(c,t-1,a,n),r=n.length;else for(var o=0,l=c.length;o<l;)n[r++]=c[o++];else a||(n[r++]=c)}return n}const Et=T((function(e,t){var a=(t=Tt(t,!1,!1)).length;if(a<1)throw new Error("bindAll must be passed function names");for(;a--;){var n=t[a];e[n]=Pt(e[n],e)}return e}));function Dt(e,t){var a=function(n){var r=a.cache,i=""+(t?t.apply(this,arguments):n);return J(r,i)||(r[i]=e.apply(this,arguments)),r[i]};return a.cache={},a}const Mt=T((function(e,t,a){return setTimeout((function(){return e.apply(null,a)}),t)})),Ft=xt(Mt,_e,1);function Nt(e,t,a){var n,r,i,s,c=0;a||(a={});var o=function(){c=!1===a.leading?0:ot(),n=null,s=e.apply(r,i),n||(r=i=null)},l=function(){var l=ot();c||!1!==a.leading||(c=l);var u=t-(l-c);return r=this,i=arguments,u<=0||u>t?(n&&(clearTimeout(n),n=null),c=l,s=e.apply(r,i),n||(r=i=null)):n||!1===a.trailing||(n=setTimeout(o,u)),s};return l.cancel=function(){clearTimeout(n),c=0,n=r=i=null},l}function Rt(e,t,a){var n,r,i,s,c,o=function(){var l=ot()-r;t>l?n=setTimeout(o,t-l):(n=null,a||(s=e.apply(c,i)),n||(i=c=null))},l=T((function(l){return c=this,i=l,r=ot(),n||(n=setTimeout(o,t),a&&(s=e.apply(c,i))),s}));return l.cancel=function(){clearTimeout(n),n=i=c=null},l}function zt(e,t){return xt(t,e)}function Lt(e){return function(){return!e.apply(this,arguments)}}function Ot(){var e=arguments,t=e.length-1;return function(){for(var a=t,n=e[t].apply(this,arguments);a--;)n=e[a].call(this,n);return n}}function qt(e,t){return function(){if(--e<1)return t.apply(this,arguments)}}function Ht(e,t){var a;return function(){return--e>0&&(a=t.apply(this,arguments)),e<=1&&(t=null),a}}const Bt=xt(Ht,2);function Ut(e,t,a){t=at(t,a);for(var n,r=de(e),i=0,s=r.length;i<s;i++)if(t(e[n=r[i]],n,e))return n}function jt(e){return function(t,a,n){a=at(a,n);for(var r=ue(t),i=e>0?0:r-1;i>=0&&i<r;i+=e)if(a(t[i],i,t))return i;return-1}}const Wt=jt(1),Gt=jt(-1);function Xt(e,t,a,n){for(var r=(a=at(a,n,1))(t),i=0,s=ue(e);i<s;){var c=Math.floor((i+s)/2);a(e[c])<r?i=c+1:s=c}return i}function Vt(e,t,a){return function(n,r,i){var s=0,c=ue(n);if("number"==typeof i)e>0?s=i>=0?i:Math.max(i+c,s):c=i>=0?Math.min(i+1,c):i+c+1;else if(a&&i&&c)return n[i=a(n,r)]===r?i:-1;if(r!=r)return(i=t(_.call(n,s,c),ae))>=0?i+s:-1;for(i=e>0?s:c-1;i>=0&&i<c;i+=e)if(n[i]===r)return i;return-1}}const $t=Vt(1,Wt,Xt),Kt=Vt(-1,Gt);function Yt(e,t,a){var n=(St(e)?Wt:Ut)(e,t,a);if(void 0!==n&&-1!==n)return e[n]}function Zt(e,t){return Yt(e,Ze(t))}function Jt(e,t,a){var n,r;if(t=Qe(t,a),St(e))for(n=0,r=e.length;n<r;n++)t(e[n],n,e);else{var i=de(e);for(n=0,r=i.length;n<r;n++)t(e[i[n]],i[n],e)}return e}function Qt(e,t,a){t=at(t,a);for(var n=!St(e)&&de(e),r=(n||e).length,i=Array(r),s=0;s<r;s++){var c=n?n[s]:s;i[s]=t(e[c],c,e)}return i}function ea(e){return function(t,a,n,r){var i=arguments.length>=3;return function(t,a,n,r){var i=!St(t)&&de(t),s=(i||t).length,c=e>0?0:s-1;for(r||(n=t[i?i[c]:c],c+=e);c>=0&&c<s;c+=e){var o=i?i[c]:c;n=a(n,t[o],o,t)}return n}(t,Qe(a,r,4),n,i)}}const ta=ea(1),aa=ea(-1);function na(e,t,a){var n=[];return t=at(t,a),Jt(e,(function(e,a,r){t(e,a,r)&&n.push(e)})),n}function ra(e,t,a){return na(e,Lt(at(t)),a)}function ia(e,t,a){t=at(t,a);for(var n=!St(e)&&de(e),r=(n||e).length,i=0;i<r;i++){var s=n?n[i]:i;if(!t(e[s],s,e))return!1}return!0}function sa(e,t,a){t=at(t,a);for(var n=!St(e)&&de(e),r=(n||e).length,i=0;i<r;i++){var s=n?n[i]:i;if(t(e[s],s,e))return!0}return!1}function ca(e,t,a,n){return St(e)||(e=Fe(e)),("number"!=typeof a||n)&&(a=0),$t(e,t,a)>=0}const oa=T((function(e,t,a){var n,r;return G(t)?r=t:(t=Xe(t),n=t.slice(0,-1),t=t[t.length-1]),Qt(e,(function(e){var i=r;if(!i){if(n&&n.length&&(e=Ve(e,n)),null==e)return;i=e[t]}return null==i?i:i.apply(e,a)}))}));function la(e,t){return Qt(e,Je(t))}function ua(e,t){return na(e,Ze(t))}function pa(e,t,a){var n,r,i=-1/0,s=-1/0;if(null==t||"number"==typeof t&&"object"!=typeof e[0]&&null!=e)for(var c=0,o=(e=St(e)?e:Fe(e)).length;c<o;c++)null!=(n=e[c])&&n>i&&(i=n);else t=at(t,a),Jt(e,(function(e,a,n){((r=t(e,a,n))>s||r===-1/0&&i===-1/0)&&(i=e,s=r)}));return i}function da(e,t,a){var n,r,i=1/0,s=1/0;if(null==t||"number"==typeof t&&"object"!=typeof e[0]&&null!=e)for(var c=0,o=(e=St(e)?e:Fe(e)).length;c<o;c++)null!=(n=e[c])&&n<i&&(i=n);else t=at(t,a),Jt(e,(function(e,a,n){((r=t(e,a,n))<s||r===1/0&&i===1/0)&&(i=e,s=r)}));return i}var fa=/[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;function ma(e){return e?Z(e)?_.call(e):z(e)?e.match(fa):St(e)?Qt(e,Ye):Fe(e):[]}function _a(e,t,a){if(null==t||a)return St(e)||(e=Fe(e)),e[ct(e.length-1)];var n=ma(e),r=ue(n);t=Math.max(Math.min(t,r),0);for(var i=r-1,s=0;s<t;s++){var c=ct(s,i),o=n[s];n[s]=n[c],n[c]=o}return n.slice(0,t)}function ga(e){return _a(e,1/0)}function ba(e,t,a){var n=0;return t=at(t,a),la(Qt(e,(function(e,a,r){return{value:e,index:n++,criteria:t(e,a,r)}})).sort((function(e,t){var a=e.criteria,n=t.criteria;if(a!==n){if(a>n||void 0===a)return 1;if(a<n||void 0===n)return-1}return e.index-t.index})),"value")}function ha(e,t){return function(a,n,r){var i=t?[[],[]]:{};return n=at(n,r),Jt(a,(function(t,r){var s=n(t,r,a);e(i,t,s)})),i}}const ya=ha((function(e,t,a){J(e,a)?e[a].push(t):e[a]=[t]})),va=ha((function(e,t,a){e[a]=t})),ka=ha((function(e,t,a){J(e,a)?e[a]++:e[a]=1})),wa=ha((function(e,t,a){e[a?0:1].push(t)}),!0);function Aa(e){return null==e?0:St(e)?e.length:de(e).length}function Ca(e,t,a){return t in a}const Ia=T((function(e,t){var a={},n=t[0];if(null==e)return a;G(n)?(t.length>1&&(n=Qe(n,t[1])),t=ke(e)):(n=Ca,t=Tt(t,!1,!1),e=Object(e));for(var r=0,i=t.length;r<i;r++){var s=t[r],c=e[s];n(c,s,e)&&(a[s]=c)}return a})),xa=T((function(e,t){var a,n=t[0];return G(n)?(n=Lt(n),t.length>1&&(a=t[1])):(t=Qt(Tt(t,!1,!1),String),n=function(e,a){return!ca(t,a)}),Ia(e,n,a)}));function Pa(e,t,a){return _.call(e,0,Math.max(0,e.length-(null==t||a?1:t)))}function Sa(e,t,a){return null==e||e.length<1?null==t||a?void 0:[]:null==t||a?e[0]:Pa(e,e.length-t)}function Ta(e,t,a){return _.call(e,null==t||a?1:t)}function Ea(e,t,a){return null==e||e.length<1?null==t||a?void 0:[]:null==t||a?e[e.length-1]:Ta(e,Math.max(0,e.length-t))}function Da(e){return na(e,Boolean)}function Ma(e,t){return Tt(e,t,!1)}const Fa=T((function(e,t){return t=Tt(t,!0,!0),na(e,(function(e){return!ca(t,e)}))})),Na=T((function(e,t){return Fa(e,t)}));function Ra(e,t,a,n){F(t)||(n=a,a=t,t=!1),null!=a&&(a=at(a,n));for(var r=[],i=[],s=0,c=ue(e);s<c;s++){var o=e[s],l=a?a(o,s,e):o;t&&!a?(s&&i===l||r.push(o),i=l):a?ca(i,l)||(i.push(l),r.push(o)):ca(r,o)||r.push(o)}return r}const za=T((function(e){return Ra(Tt(e,!0,!0))}));function La(e){for(var t=[],a=arguments.length,n=0,r=ue(e);n<r;n++){var i=e[n];if(!ca(t,i)){var s;for(s=1;s<a&&ca(arguments[s],i);s++);s===a&&t.push(i)}}return t}function Oa(e){for(var t=e&&pa(e,ue).length||0,a=Array(t),n=0;n<t;n++)a[n]=la(e,n);return a}const qa=T(Oa);function Ha(e,t){for(var a={},n=0,r=ue(e);n<r;n++)t?a[e[n]]=t[n]:a[e[n][0]]=e[n][1];return a}function Ba(e,t,a){null==t&&(t=e||0,e=0),a||(a=t<e?-1:1);for(var n=Math.max(Math.ceil((t-e)/a),0),r=Array(n),i=0;i<n;i++,e+=a)r[i]=e;return r}function Ua(e,t){if(null==t||t<1)return[];for(var a=[],n=0,r=e.length;n<r;)a.push(_.call(e,n,n+=t));return a}function ja(e,t){return e._chain?_e(t).chain():t}function Wa(e){return Jt(ze(e),(function(t){var a=_e[t]=e[t];_e.prototype[t]=function(){var e=[this._wrapped];return m.apply(e,arguments),ja(this,a.apply(_e,e))}})),_e}Jt(["pop","push","reverse","shift","sort","splice","unshift"],(function(e){var t=p[e];_e.prototype[e]=function(){var a=this._wrapped;return null!=a&&(t.apply(a,arguments),"shift"!==e&&"splice"!==e||0!==a.length||delete a[0]),ja(this,a)}})),Jt(["concat","join","slice"],(function(e){var t=p[e];_e.prototype[e]=function(){var e=this._wrapped;return null!=e&&(e=t.apply(e,arguments)),ja(this,e)}}));const Ga=_e;var Xa=Wa(e);Xa._=Xa;const Va=Xa;var $a;function Ka(e,t){var a,n,r,i,s="function"==typeof t?t:function(e){return e==t},c={abs:1,ceil:1,floor:1,round:1,max:[1],min:[1]},o={"?":1,":":2,"||":3,"&&":4,"|":5,"^":6,"&":7,"=":8,"==":8,"!=":8,">=":9,">":9,"<":9,"<=":9,"<<":10,">>":10,"+":11,"-":11,"*":12,"/":12,"%":12,"**":14,t:98,d:99},l={"!":13,"~":13,"-":13},u={"(":")","{":"}"},p=[{precedence:0}],d=[];function f(e){return e.tok=function(e){var t;if(!e)return e;function a(e,t){return{type:e,text:t[0],match:t}}return(t=e.match(/^\s+/))?a("whitespace",t):(t=e.match(/^(abs|ceil|floor|round|max|min)[(]/))?a("function",t):(t=e.match(/^[({]/))?a("opengroup",t):(t=e.match(/^[)}]/))?a("closegroup",t):(t=e.match(/^((\d+(\.\d+)?)|(\.\d+))/))?a("number",t):(t=e.match(/^['"]/))?a("quote",t):(t=e.match(/^((\|\|)|(&&)|(==)|(!=)|(>=)|(<=)|(<<)|(>>)|(\*\*)|[?:|\^&=><%!~])/))?a("extoperator",t):(t=e.match(/^[\-+*\/td]/))?a("baseoperator",t):(t=e.match(/^\[([^\]]+)\]/))?a("label",t):(t=e.match(/^\$\{([^'"\($\
  }
  ][^
}
]*)\
}
/))?a("variable",t):(t=e.match(/^\$\ {
  /))?a("openvariable",t): {
    type:"raw",text:e.charAt(0)
  }
  
}
(e.s),e.tok&&(e.s=e.s.substring(e.tok.text.length)),e
}
function m() {
  var e,t,a,n=p.pop(),r=d.pop();
  if(n.unary)d.push( {
    type:"baseoperator"===n.type?"unop":"unopex",datatype:r.datatype,operator:n.text,operand:r
  }
  );
  else {
    if(e=d.pop(),":"!==n.text)return"d"===n.text||"t"===n.text?a="number":e.datatype===r.datatype?a=e.datatype:"string"!==e.datatype&&"string"!==r.datatype||(a="string"),void d.push( {
      type:"baseoperator"===n.type?"binop":"binopex",datatype:a,operator:n.text,left:e,right:r,mods:n.mods,label:n.label
    }
    );
    if("?"!==(n=p.pop()).text)return"Error: Expected ? but got "+n.text;
    t=d.pop(),d.push( {
      type:"cond",cond:t,left:e,right:r,datatype:e.datatype===r.datatype?e.datatype:void 0
    }
    )
  }
  
}
function _(e) {
  var t;
  for(e.precedence=(e.unary?l[e.text]:o[e.text])||0;
  p[p.length-1].precedence>=e.precedence;
  )if(t=m())return t;
  p.push(e)
}
function g(e) {
  return","===e||")"===e
}
function b() {
  var t,a,n,r,i,s,o,p,m,h,y;
  if(f(e),!e.tok)return"Error: Unrecognized token: "+e.s.split(" ",1)[0];
  for(;
  "whitespace"===e.tok.type;
  )if(f(e),!e.tok)return"Error: Unrecognized token: "+e.s.split(" ",1)[0];
  switch(e.tok.type) {
    case"function":if(t=e.tok.match[1],void 0===(a=c[t]))return"Error: Unrecognized function: "+t;
    for(Array.isArray(a)?(n=a[0],r=a[1]):(n=a,r=a),s=[];
    e.tok&&")"!==e.tok.text;
    ) {
      if("string"==typeof(o=Ka(e,g)))return o;
      if(s.push(o),!e.tok)return"Error: Unterminated function: "+t;
      if(!g(e.tok.text))return"Error: Expected ',' or ')' to continue/close '"+t+"(', but got '"+e.tok.text+"'"
    }
    return n<0&&(n=s.length),(isNaN(r)||r<0)&&(r=s.length),s.length<n?"Error: Function '"+t+"' requires at least "+n+" argument(s)":s.length>r?"Error: Function '"+t+"' requires at most "+r+" argument(s)":void d.push( {
      type:"function",datatype:"number",function:t,args:s
    }
    );
    case"number":return void d.push( {
      type:"number",datatype:"number",value:parseFloat(e.tok.text)
    }
    );
    case"variable":return void d.push( {
      type:"variable",value:e.tok.match[1]
    }
    );
    case"quote":return i=function(e,t) {
      for(var a,n=-1,r=n;
      !(n-r&1);
      ) {
        if((n=e.s.indexOf(t,n+1))<0)return;
        for(r=n-1;
        r>=0&&"\\"===e.s.charAt(r);
        )r--
      }
      return a=e.s.substring(0,n).split("\\\\").map((function(e) {
        return e.replace(/\\n/g,"\n").replace(/\\r/g,"\r").replace(/\\t/g,"\t").replace(/\\/g,"")
      }
      )).join("\\"),e.s=e.s.substring(n),f(e),a
    }
    (e,e.tok.text),"string"!=typeof i?"Error: Unterminated string":void d.push( {
      type:"string",datatype:"string",value:i
    }
    );
    case"opengroup":return p=e.tok.text,"string"==typeof(h=Ka(e,m=u[p]))?h:(d.push(h),e.tok.text!==m?"Error: Expected '"+m+"' to close '"+p+"', but got '"+e.tok.text+"'":void 0);
    case"openvariable":return"string"==typeof(y=Ka(e,"}"))?y:"}"!==e.tok.text?"Error: Expected '}' to close '${', but got '"+e.tok.text+"'":void d.push( {
      type:"variable",value:y
    }
    );
    case"extoperator":case"baseoperator":return l[e.tok.text]?(e.tok.unary=!0,_(e.tok)||b()):"Error: "+e.tok.text+" is not a unary operator"
  }
  return"Error: Unrecognized token: "+e.tok.text+("raw"===e.tok.type?e.s.split(" ",1)[0]:"")
}
if("string"==typeof e&&(e= {
  s:e
}
),r=b())return r;
for(f(e);
e.tok&&!s(e.tok.text)&&(t||"raw"!==e.tok.type);
f(e))switch(e.tok.type) {
  case"extoperator":case"baseoperator":if($a="d"===e.tok.text?e.tok:null,r=_(e.tok))return r;
  if($a&&"F"===e.s.charAt(0))d.push( {
    type:"rollspec",value:"F"
  }
  ),e.s=e.s.substring(1);
  else if("t"===e.tok.text) {
    if("["!==e.s.charAt(0))return"Error: 't' operator requires '[table]' argument";
    if(n=e.s.match(/^\[([^'"$(\]][^\]]*)\]/))a=n[1],e.s=e.s.substring(n[0].length);else{if(e.s=e.s.substring(1),"string"==typeof(a=Ka(e,"]")))return a;if("]"!==e.tok.text)return"Error: Expected ']' to close 't[', but got '"+e.tok.text+"'"}d.push({type:"tablename",value:a})}else if(r=b())return r;$a&&(n=e.s.match(/^[acdfhkloprs0-9<=>!]+/))&&($a.mods=n[0],e.s=e.s.substring(n[0].length));break;case"label":if(p.length>0&&"d"===p[p.length-1].text){p[p.length-1].label=e.tok.match[1];break}(i=d.pop())&&(i.label=e.tok.match[1],d.push(i))}for(;p.length>1;)if(r=m())return r;return d.pop()}function Ya(e){n().debug("EXEXP:"+e)}function Za(e,t,a,r){var i,s,c,o,l={abs:Math.abs,ceil:Math.ceil,floor:Math.floor,round:Math.round,max:Math.max,min:Math.min},u={"||":function(e,t){return e||t},"&&":function(e,t){return e&&t},"|":function(e,t){return e|t},"^":function(e,t){return e^t},"&":function(e,t){return e&t},"=":function(e,t){return e==t},"==":function(e,t){return e===t},"!=":function(e,t){return e!=t},">=":function(e,t){return e>=t},">":function(e,t){return e>t},"<":function(e,t){return e<t},"<=":function(e,t){return e<=t},"<<":function(e,t){return e<<t},">>":function(e,t){return e>>t},"+":function(e,t){return e+t},"-":function(e,t){return e-t},"*":function(e,t){return e*t},"/":function(e,t){return e/t},"%":function(e,t){return e%t},"**":Math.pow,d:function(e,t){var a=0,n=0;for(n=0;n<e;n++)a+=randomInteger(t);return a}},p={"!":function(e){return!e},"~":function(e){return~e},"-":function(e){return-e}},d={},f=[],m=[],_=0,g=!1,b=[];function h(e,t,a,n,r,i){var s,c,o,d=[],f=0;switch(e.label&&(t[e.label]=e),e.type){case"number":case"rollspec":return e.baseValid=!0,e;case"string":return e;case"tablename":if("string"!=typeof e.value){if("string"==typeof(s=h(e.value,t,a,n,r,!0)))return s;if("number"===s.type&&(s.value=String(s.value),s.type="string"),"string"!==s.type)return e.baseValid&&(e.baseValid=!1),n.push(e.value),e;e.value=s.value}return e.baseValid=!0,e;case"function":for(f=0;f<e.args.length;f++){if("string"==typeof(s=h(e.args[f],t,a,n,r,!0)))return s;if("string"===s.type&&(s.value=parseFloat(s.value),s.type="number"),"number"!==s.type)return e.baseValid&&(e.baseValid=!1),e;d.push(s.value)}for(e.type="number",e.datatype="number",e.value=l[e.function].apply(d,d),f=0;f<e.args.length;f++)e.args[f].label&&(t[e.args[f].label]=e.args[f]);return delete e.function,delete e.args,e.baseValid=!0,e;case"unop":case"unopex":if(i=i||"unop"!==e.type,"string"==typeof(s=h(e.operand,t,a,n,r,i)))return s;if(i){if("number"!==s.type)return e.baseValid&&(e.baseValid=!1),e;e.type="number",e.datatype="number",e.value=p[e.operator](s.value),delete e.operator,e.operand.label&&(t[e.operand.label]=s),delete e.operand,e.baseValid=!0}else e.baseValid=s.baseValid;return e;case"binop":case"binopex":if(o=(i=i||"binop"!==e.type||"string"===e.left.datatype||"string"===e.right.datatype)||"d"===e.operator||"t"===e.operator,s=h(e.left,t,a,n,r,o),c=h(e.right,t,a,n,r,o),"string"==typeof s)return s;if("string"==typeof c)return c;if(i=!0){if("number"!==s.type&&"string"!==s.type)return e.baseValid&&(e.baseValid=!1),e;if("number"!==c.type&&"string"!==c.type&&"rollspec"!==c.type&&"tablename"!==c.type)return e.baseValid&&(e.baseValid=!1),e;if("rollspec"===c.type&&"d"!==e.operator)return"Rollspec operand is only compatible with 'd' operator";if("t"===e.operator&&"tablename"!==c.type)return"'t' operator requires tablename operand";if("t"===e.operator||"d"===e.operator&&e.mods)return r.push(e),e;e.value=u[e.operator](s.value,c.value),delete e.operator,e.left.label&&(t[e.left.label]=s),delete e.left,e.right.label&&(t[e.right.label]=c),delete e.right,e.type="string"==typeof e.value?"string":"number",e.datatype=e.type,e.baseValid="number"===e.datatype}else"number"===s.datatype&&"number"===c.datatype&&(e.datatype="number",e.baseValid=!0);return e;case"cond":return"string"==typeof(s=h(e.cond,t,a,n,r,!0))?s:"number"!==s.type&&"string"!==s.type?(e.baseValid=!1,e):(c=s.value?e.left:e.right,e.cond.label&&(t[e.cond.label]=s),delete e.cond,delete e.left,delete e.right,Va.each(c,(function(t){e[t]=c[t]})),h(e,t,a,n,r,i));case"variable":if("string"!=typeof e.value){if("string"==typeof(s=h(e.value,t,a,n,r,!0)))return s;if("number"===s.type&&(s.value=String(s.value),s.type="string"),"string"!==s.type)return e.baseValid&&(e.baseValid=!1),n.push(e.value),e;e.value=s.value}return!t[e.value]||"string"!==t[e.value].type&&"number"!==t[e.value].type?(a[e.value]||(a[e.value]=[]),a[e.value].push(e),e.baseValid&&(e.baseValid=!1)):(e.type=t[e.value].type,e.datatype=t[e.value].datatype,e.baseValid=t[e.value].baseValid,e.value=t[e.value].value),e;default:return"Unknown node type: "+e.type}}function y(e){var t=0;if("number"===e.type||"string"===e.type||"rollspec"===e.type)return!1;if(e.label)return!0;switch(e.type){case"function":for(t=0;t<e.args.length;t++)if(y(e.args[t]))return!0;return!1;case"tablename":case"variable":return"string"!=typeof e.value&&y(e.value);case"unop":case"unopex":return y(e.operand);case"cond":return!!y(e.cond)||(!!y(e.left)||y(e.right));case"binop":case"binopex":return!!y(e.left)||y(e.right)}}function v(e){var t;switch(e.type){case"number":case"rollspec":t=e.value||0;break;case"tablename":t="["+e.value+"]";break;case"unop":t="("+e.operator+v(e.operand)+")";break;case"binop":t="("+v(e.left)+e.operator+v(e.right)+(e.mods||"")+")",e.label&&"d"===e.operator&&(t+="["+e.label+"]");break;default:return"Unknown node type: "+e.type}return t}function k(e){return"string"===e.type?e.value:v(e)}function w(e){return Ya("Error: "+e),""}for(_=0;_<a.length;_++)delete(i=a[_][0]).operator,delete i.left,delete i.right,i.type="number",i.datatype="number",i.value=a[_][1],i.baseValid=!0;for(_=0;_<t.length;_++)if(!t[_].baseValid&&"string"!==t[_].type&&"number"!==t[_].type&&"string"==typeof(s=h(t[_],r,d,f,m,!1)))return w(s);for(g=!0;g;){for(c in g=!1,d)if(d.hasOwnProperty(c)){if(!r[c])return w("Variable '"+c+"' not defined");if("string"!==r[c].type&&"number"!==r[c].type){if("string"==typeof(s=h(r[c],r,d,f,m,!0)))return w(s)}else if("string"===r[c].type||"number"===r[c].type){for(_=0;_<d[c].length;_++)d[c][_].type=r[c].type,d[c][_].datatype=r[c].datatype,d[c][_].value=r[c].value,d[c][_].baseValid=r[c].baseValid;delete d[c],g=!0}}for(;f.length>0;){if("string"==typeof(o=h(f.shift(),r,d,f,m,!0)))return w(s);"string"===o.type||"number"===o.type?g=!0:b.push(o)}f=b}for(_=t.length-1;_>=0;_--)(t[_].baseValid||"number"===t[_].type||"string"===t[_].type)&&(f.length>0&y(t[_])||e.splice(_,2,(e[_]||"")+k(t.splice(_,1)[0])+(e[_+1]||"")));return m.length>0?(n().error("Cannot evaluate"),""):t.length>0&&(1!==t.length||"binop"!==t[0].type)?Za(e,t,[],r):e.join("")}function Ja(e,t,a){Va.each(e,(function(t,a){""===t||t||!isNaN(t)&&void 0!==t||(e[a]="",n().warn("#####################################","Setting NaN or undefined for attribute: "+a+" resetting to '' ","#####################################"),!0)})),setAttrs(e,t,a)}n().config({logging:{info:!1,debug:!1}});n().callback((function(e,t){getAttrs(e,(function(e){t(e)}))}));function Qa(e){var t="";try{e&&((t=getTranslationByKey(e))||(t=e[0].toUpperCase()+e.slice(1)))}catch(a){n().error("getTranslationByKey error translating: "+e,a),t=e[0].toUpperCase()+e.slice(1)}finally{return t}}function en(e,t){var a;if("function"==typeof t){if(!e)return n().warn("findAndReplaceFields called with no string, return null"),void t(null);try{if(e=(e=(e=e.split("selected|").join("")).split("target|").join("")).replace(/\|max\}/g,"_max}"),!(a=e.match(/\@\{[^}]+\}/g)))return void t(e);a=a.sort(),a=Va.uniq(a,!0),a=Va.map(a,(function(e){return e.slice(2,-1)})),getAttrs(a,(function(r){var i,s=e,c=null;try{Va.each(a,(function(e){i=s.split("@{"+e+"}"),s=i.join(r[e])})),c=s.match(/\@\{[^}]+\}/g)}catch(e){n().error("SWUtils.findAndReplaceFields err2",e),s=null}finally{c?en(s,t):t(s)}}))}catch(e){n().error("SWUtils.findAndReplaceFields",e),t(null)}}else n().error("findAndReplaceFields called with no callback function")}function tn(e,t,a){var r;if("function"==typeof t)if(""!==e&&null!=e){var i;if(r=Number(e),isNaN(r))return((i=e).match(/\(/g)||[]).length!==(i.match(/\)/g)||[]).length||(i.match(/\{/g)||[]).length!==(i.match(/\}/g)||[]).length||(i.match(/\[/g)||[]).length!==(i.match(/\]/g)||[]).length?(n().warn("evaluateExpression: Mismatched brackets, cannot evaluate:"+e),void a(null)):void en(e,(function(r){var i,s,c,o,l,u,p;if(null!=r)try{if(r=function(e){var t={kl:"min",kh:"max"};if(e)for(;/([^@%]|^){((?:[^{]|[%@]{)+?)}(k[hl])\d+/.test(e);)e=e.replace(/([^@%]|^){((?:[^{]|[%@]{)+?)}(k[hl])\d+/g,(function(e,a,n,r){return a+t[r]+"("+n+")"})),n().log("str: "+e);return e}(r=(r=r.replace(/\s+/g,"").replace(/\[\[/g,"(").replace(/\]\]/g,")")).replace(/\[[^\]]+\]/g,"")),((p=r).match(/\||\?|&|\{|\}|k[h,l][^1]/)||p.replace(/floor|ceil|round|abs|max|min|kh1|kl1/g,"").match(/[a-zA-Z]/))&&(n().warn("cannot evaluate this to number: "+e+" came back with "+r),a(null)),""===r||null==r)return void t(0);if(i=Number(r),!isNaN(i)&&isFinite(r))return void t(i);l=[],u=[],i="string"==typeof(o=Ka(c={s:s=(s=r).replace(/\s/g,"").replace(/^-/,"0-").replace(/\(-/g,"(0-").replace(/^\+/,"").replace(/\(\+/g,"(0+")},null))?(Ya("could not parse"+s),""):(u.push(o),c.s=c.tok?c.tok.text+c.s:c.s,l.push(c.s),Za(l,u,[],{})),isNaN(i)?(n().warn("cannot evaluate this to number: "+e+" came back with "+r),a(null)):t(i)}catch(e){n().error("error trying to convert to number:"+e),a(null)}else t(0)}));t(r)}else t(0)}function an(e,t,a,r,i,s){var c=function(e,a,n,i){var s={};i&&(s[t+"_error"]=0,setAttrs(s,{silent:!0})),"function"==typeof r&&r(e,a,n)},o=function(e,a,n,i){var c={};i||(c[t+"_error"]=1,setAttrs(c,{silent:!0})),"function"==typeof s?s(e,a,n):"function"==typeof r&&r(e,a,n)};getAttrs([e,t,t+"_error"],(function(r){var s={},l=0,u=0,p=0;try{i&&(s.silent=!0),p=parseInt(r[t+"_error"],10)||0,l=a||0,u=parseInt(r[t],10),tn(r[e],(function(e){var a={};isNaN(u)||e!=u?(a[t]=e,Ja(a,s,(function(){c(e,u,!0,p)}))):c(e,u,!1,p)}),(function(){var e={};isNaN(u)||l!=u?(e[t]=l,Ja(e,s,(function(){o(l,u,!0,p)}))):o(l,u,!1,p)}))}catch(e){n().error("SWUtils.evaluateAndSetNumber",e),o(0,0,0,0)}}))}function nn(e,t,a,r,i,s){var c=function(){"function"==typeof e&&e()};tn(a,(function(e){var a,n=parseInt(i,10)||0,o=parseInt(s,10)||0,l={},u={};(a=(e=parseInt(e,10)||0)+o)!==n?(u[r]=a,t&&(l={silent:!0}),Ja(u,l,c)):c()}),(function(){n().warn("SWUtils.evaluateAndAdd error returned evaluating "+a),c()}))}function rn(e,t,a,n,r){getAttrs([a,n,r],(function(i){nn(e,t,i[a],n,i[n],i[r])}))}function sn(e,t,a,n,r){getAttrs([a,n,r],(function(i){!function(e,t,a,n,r,i,s){var c=function(){"function"==typeof e&&e()};tn(a,(function(e){var a={},o={},l={};r=parseInt(r,10)||0,(e=parseInt(e,10)||0)!==r?(t?(l[n]=e,a={silent:!0}):(o[n]=e,Ja(o,{silent:!0})),s=parseInt(s,10)||0,s+=e-r,l[i]=s,Ja(l,a,c)):c()}),c)}(e,t,i[a],n,i[n],r,i[r])}))}function cn(e,t){return"0"===e||0===e||"dual"===e||e&&0===e[0]?0:e?t?t(e):e:""}function ln(e,t,a,n,r,i,s){var c={},o={},l={};(isNaN(e)||e===a)&&"function"==typeof i&&i(),s?(l[t]=e,c={silent:!0}):(o[t]=e,Ja(o,{silent:!0})),r+=e-a,l[n]=r,Ja(l,c,i)}function un(e,t,a,n,r){var i=function(e,t,a){"function"==typeof n&&n(e,t,a)};getAttrs([e],(function(n){var s,c={},o=[];s=cn(n[e],a),r&&(c.silent=!0),o=[t],s&&o.push(s),getAttrs(o,(function(e){var a,n=0,r={};n=s?parseInt(e[s],10)||0:s,(a=parseInt(e[t],10))!==n||isNaN(a)?(r[t]=n,setAttrs(r,c,(function(){i(n,a,!0)}))):i(n,a,!1)}))}))}function pn(e,t,a,r,i,s,c){var o=function(){"function"==typeof i&&i()};!function(e,t,a,r,i,s){var c;if("function"==typeof i&&"function"==typeof s){try{if(!e||!Array.isArray(e)||0===e.length)return;c=a&&Array.isArray(a)&&a.length>0?e.concat(a):e}catch(e){return n().error("SWUtils.getRowTotal catastrophic error: ",e),void s()}getAttrs(c,(function(c){var o,l=r?parseFloat(c[e[0]]):parseInt(c[e[0]],10),u=0,p=0;try{for(o=1;o<e.length;o++)u+=parseFloat(c[e[o]])||0;if(t&&!isNaN(parseInt(t,10))&&(u+=parseFloat(t)),a){for(o=0;o<a.length;o++)p+=parseFloat(c[a[o]])||0;u-=p}r||(u=Math.floor(u)),i(u,l)}catch(e){n().error("SWUtils.getRowTotal",e),s()}}))}}(e,t,a,r,(function(t,a){var n={},r={};(c||t!==a)&&(n[e[0]]=t),Va.size(n)>0?(s&&(r.silent=!0),setAttrs(n,r,o)):o()}),o)}function dn(e){return e?e.replace(/\{\{/g,"&#123;&#123;"):e}function fn(e){var t,a="";return e?((t=/^([^\[]*?)\[([^\]]*?)\]\(([^\)]*?)\)(.*)$/.exec(e))?(t[1]&&(a+=t[1]),t[2]&&(a+=t[2]),t[4]&&(a+=t[4])):a=e,a=function(e){return e?Va.reduce([[/\{\{/g,"&#123;&#123;"],[/\}\}/g,"&#125;&#125;"],[/\(/g,"&#40;"],[/\)/g,"&#41;"],[/\,/g,"&#44;"],[/\?/g,"&#63;"],[/'/g,"&#39;"],[/"/g,"&#34;
    "],[/\=/g,"&#61;
    "]],(function(e,t){return e.replace(t[0],t[1])}),e):""}(a=a.replace(/\[/g,"&#91;
    ").replace(/\]/g,"&#93;
    ")),a):e}function mn(e){if(!e)return"";var t=e.split("_");return t&&Va.size(t)>=3?t[2]:""}function _n(e){var t,a="";return e?((t=mn(e))?a=e.substring(e.indexOf(t)+t.length+1,e.length):0===e.indexOf("repeating_")&&(e=e.slice(10)).indexOf("_")>0&&(a=e.slice(e.indexOf("_")+1)),a):""}function gn(e){var t="";return null!=e&&(t=e+"_"),t}function bn(){return Va.reduce(arguments,(function(e,t){return Va.flatten(Va.map(e,(function(e){return Va.map(t,(function(t){return String(e)+String(t)}))})),!0)}),[[]])}function hn(e){return Array.isArray(e)?Va.map(e,hn):"string"==typeof e?e.replace(/^\s*|\s*$/g,""):e}function yn(e){var t=[];return e?(t=hn(t=e.match(/((?:[^(),]|\([^()]*\))+)/g)),Va.uniq(t)):[]}function vn(e){return e?"0"===e.slice(0,1)?"":/str.mod/i.test(e)?"STR-mod":/dex.mod/i.test(e)?"DEX-mod":/con.mod/i.test(e)?"CON-mod":/int.mod/i.test(e)?"INT-mod":/wis.mod/i.test(e)?"WIS-mod":/cha.mod/i.test(e)?"CHA-mod":/melee2/i.test(e)?"attk-melee2":/melee/i.test(e)?"attk-melee":/ranged2/i.test(e)?"attk-ranged2":/ranged/i.test(e)?"attk-ranged":/cmb2/i.test(e)?"CMB2":/cmb/i.test(e)?"CMB":/dual/i.test(e)?"dual":/str/i.test(e)?"STR":/dex/i.test(e)?"DEX":/con/i.test(e)?"CON":/int/i.test(e)?"INT":/wis/i.test(e)?"WIS":/cha/i.test(e)?"CHA":/npc.type/i.test(e)?"npc-type":/race/i.test(e)?"race":/class.0.level/i.test(e)?"class-0-level":/\{level\}/i.test(e)?"level":/npc.hd.num/i.test(e)?"npc-hd-num":/class.1.level/i.test(e)?"class-1-level":/class.2.level/i.test(e)?"class-2-level":/class.3.level/i.test(e)?"class-3-level":/class.4.level/i.test(e)?"class-4-level":/class.5.level/i.test(e)?"class-5-level":/class.0.name/i.test(e)?"class-0-name":/class.1.name/i.test(e)?"class-1-name":/class.2.name/i.test(e)?"class-2-name":/class.3.name/i.test(e)?"class-3-name":/class.4.name/i.test(e)?"class-4-name":/class.5.name/i.test(e)?"class-5-name":e.replace("@ {
      ","").replace("
    }
    ",""):""}function kn(e,t){return e=e||0,t=t>0?.3048:1,{close:Math.round((25+5*Math.floor(e/2))*t),medium:Math.round((100+10*e)*t),long:Math.round((400+40*e)*t)}}function wn(e,t,a,n){var r=0,i=kn(a,n);switch(a=a||0," {
      "===(t=t||"blank")[0]&&(t=t.slice(2,t.indexOf("="))),t){case"number":case"custom":r=parseInt(e,10)||0;break;case"perlevel":r=(parseInt(e,10)||0)*a;break;case"close":r=i.close;break;case"medium":r=i.medium;break;case"long":r=i.long;break;default:r=0}return r}function An(e,t,a){return 0!==e?-1*(e*(a+1)-t):0}function Cn(e){return"range_pick"===e}function In(e,t){if(!t)return!0;switch(e){case"sr":return!/^y/i.test(t);case"save":case"saving_throw":return(/^no/i.test(t)||/harmless/i.test(t))&&!/and|or/i.test(t);case"spell_fail":return 0!==(parseInt(t,10)||0);default:return!1}}function xn(e,t,a){var n=Cn(t)?" {
         {
          ="+t+"
        }
        
      }
      ":" {
         {
          "+t+"=
        }
        
      }
      ";return t&&e&&a[t]&&(e=e.replace(a[t],n)),e}function Pn(e,t,a,n,r){var i=0,s=1;return 0===t?0:(.5!==a&&.75!==a&&1!==a&&(a=.5),r&&(s=2,a=.5),1===a?i=t*e:(n&&e--,i=Math.floor(100*(t+s)*a*e/100),n&&(i+=t)),i)}function Sn(e,t){var a,r,i,s="",c=0,o=!1,l=-1,u="";try{if(!e)return t?("unknownrange"===(i=Sn(t,null)).dropdown&&(i.dropdown="blank"),"number"!==i.dropdown&&"perlevel"!==i.dropdown&&(i.useorig=!1,i.rangetext=""),i):{dropdown:"blank",useorig:!1,rangetext:"",number:0};if(e=e.toLowerCase(),s||"unlimited"!==e||("unknownrange"===(i=Sn(t,null)).dropdown?s="blank":(s=i.dropdown,/short|medium|long/.test(s)||(o=i.useorig)&&i.rangetext&&(e=i.rangetext))),s||(a=e.match(/(.*?)\s+(or|and)\s+/))&&a[1]&&(i=Sn(e.substring(a[0].length),null))&&"unknownrange"!==i.dropdown&&"blank"!==i.dropdown&&(s=i.dropdown,i.rangetext&&(e="number"===s?i.rangetext?i.rangetext+" "+a[2]+" "+a[1]:i.number+" ft. "+a[2]+" "+a[1]:"perlevel"===s?i.rangetext?i.rangetext+"/level "+a[2]+" "+a[1]:i.number+"ft. /level  "+a[2]+" "+a[1]:a[1]+" "+a[2]+" "+i.rangetext),o=!0),!s)if("you"===e)s="personal";else if((a=e.match(/close|short|medium|long|touch|see text|personal|special|\/level/))&&a[0])switch(a[0]){case"close":case"medium":case"long":case"personal":case"touch":case"see text":s=a[0];break;case"short":s="close";break;case"special":s="see_text";break;case"/level":(r=e.match(/(\d+)(\D*)\/level/))&&r[1]&&(c=parseInt(r[1],10)||0,e=r[1]+(r[2]||""),o=!0,s="perlevel",l=c)}s||(c=parseInt(e,10),!isNaN(c)&&c>0?(s="number",l=c,o=!0):(r=e.match(/within\s|more\sthan\s/))&&r[0]&&(e=e.substring(r[0].index+r[0].length),c=parseInt(e,10),!isNaN(c)&&c>0&&(s="number",l=c,o=!0))),!s&&t&&("number"!==(s=(i=Sn(t,null)).dropdown)&&"perlevel"!==s||(o=!0,e=i.rangetext))}catch(e){n().error("parseSpellRangeText, error",e),s="unknownrange",o=!0}return s||(s="unknownrange",o=!0),!0===o&&(u="unknownrange"!==s?e.replace(/\s*\(.*?\)/,"").replace(/^\s+/,"").replace(/\s+$/,"").replace("feet","ft."):e),{dropdown:s,useorig:o,number:l,rangetext:u}}function Tn(e){return o.findBadNegDice.test(e)?e.replace(o.findBadNegDice,"$1d$2-$3"):e}function En(e){return e.replace(o.findBadCritRange,"$1-20")}function Dn(e){return e.replace(o.dashtominusreg,"-")}function Mn(e){var t=0,a=e.match(/(\d+)/);if(n().debug("PFUtil.getCostInGP: parsing:"+e+", match on number:",a),a&&(t=parseInt(a[1],10)||0,a=e.match(/(gp|cp|sp|pp)/i),n().debug("PFUtil.getCostInGP: parsing:"+e+", match on coins:",a),a))switch(a[1]){case"pp":t*=10;break;case"sp":t/=10;break;case"cp":t/=100}return t}function Fn(e,t,a){var n,r=0;return t||(e=Dn(e=En(e))),(n=a?e.match(/^[\+\-]{0,1}\d+/):e.match(/[\+\-]{0,1}\d+/))&&(r=parseInt(n[0],10)||0),r}function Nn(e,t){var a,n={crit:20,critmult:2,spaces:0};return t||(e=En(e=Dn(e))),n.critmult=2,null!==(a=o.critreg.exec(e))?(n.crit=parseInt(a[1],10),a[2]&&(n.critmult=parseInt(a[2],10)),n.spaces=a[0].length):null!==(a=o.critmultreg.exec(e))&&(n.critmult=parseInt(a[1],10),n.spaces=a[0].length),n}function Rn(e,t,a){var r,i={dice:0,die:0,plus:0,spaces:0},s=1;return e?(t||(e=Dn(e=Tn(e))),(r=e.match(o.diceDiereg))&&(a&&0!==r.index||(i.spaces=r[0].length+r.index,i.dice=parseInt(r[1],10)||0,i.die=parseInt(r[2],10)||0,r[3]&&"-"===r[3]&&(s=-1),r[4]&&(i.plus=s*(parseInt(r[4],10)||0)))),n().debug("x1  at getDiceDieFromString parsing "+e,r,i),i):i}function zn(e){var t;return e&&(t=/\b(Su|Ex|Sp)\b/i.exec(e))?t[1][0].toUpperCase()+t[1][2].toLowerCase():""}function Ln(e,t){var a,n,r,i;if(e.indexOf("(")<0||e.indexOf(",")<0)return e;if(n=(a=e.split(/\s*\(\s*/)).length>1?a[1].split(/,\s*/):e.split(/,\s*/),r=t?n[0]:a[0]+"("+n[1],n.length>2)for(i=2;i<n.length;i++)r+=","+n[i];return r}function On(e,t,a,n,r){var i="",s="floor(",c="/2)";return i="DC [[ 10 ",e&&(a&&"CON"===e&&(e="CHA"),i+="+ @ {
        "+e+"-mod
      }
       "),t&&(r?(s="",c=""):i+="+ "+s+"@ {
        "+t+"
      }
      "+c+" "),n&&(i+="+ "+n),i+=" ]]"}function qn(e){var t;return e&&(t=e.match(/\d+/))&&(e=hn(e.slice(t.index+t.length))),e}function Hn(e,t,a,r,i){var s,c=0;try{(s=a[e+t+"_compendium"])&&(c=Fn(s))&&(i=i||t,r[e+t]=c)}catch(a){n().error("getCompendiumIntSet error on :"+e+", field:"+t+", setField:"+i,a)}finally{return r}}function Bn(e,t,a,n,r){var i=null;r&&(i=vn),un(e,t,i,a,n)}function Un(e,t,a,n,r,i,s){var c="repeating_"+e+"_"+gn(t),o=null;s&&(o=vn),un(c+a,c+n,o,r,i)}var jn={"header_image-pf_spell":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_spell.png)","header_image-pf_attack-melee":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_attack_melee.png)","header_image-pf_attack-dual":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_attack_dual.png)","header_image-pf_attack-ranged":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_attack_ranged.png)","header_image-pf_attack-cmb":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_attack_cmb.png)","header_image-pf_defense":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_defense.png)","header_image-pf_generic":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_generic.png)","header_image-pf_ability":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_ability.png)","header_image-pf_block":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_block.png)","header_image-pf_generic-skill":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_generic.png)","header_image-pf_generic-init":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_generic_initiative.png)","header_image-pf_block-item":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_block_item.png)","header_image-pf_block-check":"[default](https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Pathfinder%20Community/Images/pf_block_ability_check.png)"},Wn=Object.keys(jn);function Gn(e){return Gn="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},Gn(e)}function Xn(e){return function(e){if(Array.isArray(e))return Vn(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return Vn(e,t);var a={}.toString.call(e).slice(8,-1);return"Object"===a&&e.constructor&&(a=e.constructor.name),"Map"===a||"Set"===a?Array.from(e):"Arguments"===a||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a)?Vn(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Vn(e,t){(null==t||t>e.length)&&(t=e.length);for(var a=0,n=Array(t);a<t;a++)n[a]=e[a];return n}function $n(e,t,a){return(t=function(e){var t=function(e,t){if("object"!=Gn(e)||!e)return e;var a=e[Symbol.toPrimitive];if(void 0!==a){var n=a.call(e,t||"default");if("object"!=Gn(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(e)}(e,"string");return"symbol"==Gn(t)?t:t+""}(t))in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function Kn(e){var t=[],a=[];try{a=function(e){var t,a,r;return e?(t=hn(t=e.split(/(?=\{\{)|(?=\&\{)|(?=\|\|)/)),Va.reduce(t,(function(e,t){try{" {
         {
          "===t.slice(0,2)?"
        }
        
      }
      "===t.slice(-2)?e.push(t):(a=t.lastIndexOf("
    }
    
  }
  "))<0?(n().error("error! no closing brackets for ",t),a=(t+="
}

}
").lastIndexOf("
}

}
"),e.push(t)):(e.push(hn(t.slice(0,a+2))),e=e.concat(hn(hn(t.slice(a+2)).replace("&amp;
","&").split(/(?=[\@\&]\{)/)))):"& {
  "===t.slice(0,2)?(t=t.replace("&amp;
  ","&"),e=e.concat(hn(t.split(/(?=[\@\&]\{)/)))):"||"===t.slice(0,2)?"||"!==hn(t)&&(t=t.replace("&amp;
  ","&"),"||"===(r=hn(t.split(/(?=[\@\&]\{)/)))[0]?r=r.slice(1):"||"!==r[0].slice(-2)&&(r[0]=r[0]+"||"),e=e.concat(r)):(t=t.replace("&amp;
  ","&"),e=e.concat(hn(t.split(/(?=[\@\&]\{)/))))}catch(e){n().error("splitmacro",e)}finally{return e}}),[])):""}(e),n().debug("PFMacros.getTracking array is ",a),a&&Va.size(a)&&(t=a.filter((function(e){return/^\{\{[a-z]+tracking\d+=/i.test(e)})).concat(a.filter((function(e){return" {
     {
      "!==e.slice(0,1)&&e.indexOf("||")>=0?1:0})))),n().debug("PFMacros.getTracking tracking is ",t)}catch(e){n().error("PFMacros.getTracking error",e)}finally{return t}}on("change:header_images_toggle",(function(){getAttrs(Wn.concat(["header_images_toggle"]),(function(e){var t=+e.header_images_toggle||0,a={};Wn.forEach((function(n){var r=e[n];r!==jn[n]&&""!==r||(a[n]=t>0?jn[n]:"")})),a&&setAttrs(a)}))})),Va.each(o.repeatingSections,(function(e){on("change:repeating_"+e+":ids-show",n().callback((function(t){var a,r={};n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||(a=mn(t.sourceAttribute),r["repeating_"+e+"_"+a+"_row_id"]=a,Ja(r,o.silentParams))})))}));function Yn(e,t,a,n){return a=a||"",(e=e||"")||t?(t+=n,a?e+=" "+a:n&&(e+=n>0?" + ":" - ",e+=String(Math.abs(n)))):n?(e=String(n),t=n):(e="",t=0),{macroText:e,macroVal:t}}function Zn(e,t,a,r,i,s){var c=Va.once((function(){"function"==typeof e&&e()})),l=[a,r,s,t];i&&l.push(i),getAttrs(l,(function(e){var l=0,u=0,p={},d={},f="";try{parseInt(e[t],10)||(l=parseInt(e[s],10)||0,u=parseInt(e[r],10)||0,i&&(f=e[i]),(p=Yn(e[a],u,f,l)).macroText&&p.macroText!==e[a]&&(d[a]=p.macroText,d[r]=p.macroVal),d[t]=1,d[s]="",i&&(d[i]=""))}catch(e){n().error("PFMigrate.migrateMoveIntIntoMacro:"+t,e)}finally{Va.size(d)>0?Ja(d,o.silentParams,c):c()}}))}function Jn(e){Zn(e,"migrated_hp_misc","HP-formula-macro-text","HP-formula-mod","","HP-misc")}function Qn(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["migrated_npc","is_npc"],(function(e){var t=0,r=0,i=Va.after(3,a);try{t=parseInt(e.is_npc,10)||0,r=parseInt(e.migrated_npc,10)||0,t||(r?a():Ja({migrated_npc:1},o.silentParams,a)),r?a():(function(e){var t=function(){"function"==typeof e&&e()};getAttrs(["senses","vision","character-description"],(function(e){var a="",r="",i="",s={};try{a=e.senses||"",r=e.vision||"",(i=a&&r?a+", "+r:a||r)&&(s.vision=i),a&&(s.senses="")}catch(e){n().error("migrateNPCSenses",e)}finally{Va.size(s)>0?Ja(s,o.silentParams,t):t()}}))}(i),function(e){Ja({normal_macro_show:1,use_traits:0,use_racial_traits:0,"npc-compimport-show":0},o.silentParams,e)}(i),function(e){var t=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["HP-ability","HP-ability-mod","npc-type","CON-mod","CHA-mod","total-hp","level","bab","HP-formula-macro-text","HP-formula-mod","class-0-level","class-1-level","class-2-level","class-3-level","class-4-level","class-5-level","class-0-hp","class-1-hp","class-2-hp","class-3-hp","class-4-hp","class-5-hp","is_undead","npc-hd-misc","npc-hd-misc-mod","npc-hd","npc-hd-num","npc-hd2","npc-hd-num2","npc-bab"],(function(e){var a=0,r=0,i="",s=0,c=0,l=0,u=0,p=0,d=0,f=0,m=0,_=0,g=0,b=0,h=0,y=0,v=0,k={},w=0,A=0,C={},I=0,x=0;try{if(p=parseInt(e["npc-hd-num"],10)||0,d=parseInt(e["npc-hd"],10)||0,p>0&&d>0&&(k.auto_calc_hp="1"),s=parseInt(e["npc-hd-num2"],10)||0,c=parseInt(e["npc-hd2"],10)||0,a=/undead/i.test(e["npc-type"])||parseInt(e.is_undead,10)||0,k.is_undead=a,y=parseInt(e.level,10)||0,v=parseInt(e.HP,10)||0,(A=(w=parseInt(e.bab,10)||0)+(parseInt(e["npc-bab"],10)||0))!==w&&(k.bab=A),b=(r=a?parseInt(e["CHA-mod"],10)||0:parseInt(e["HP-ability-mod"],10)||0)*(y||p),i=a?"@ {
        CHA-mod
      }
      ":"@ {
        CON-mod
      }
      ",k["HP-ability"]=i,k["HP-ability-mod"]=r,I=parseInt(e["npc-hd-misc-mod"],10)||0,x=parseInt(e["HP-formula-mod"],10)||0,(I||e["HP-formula-macro-text"])&&(k["npc-hd-misc"]="",k["npc-hd-misc-mod"]=""),I&&(I-=b),(C=Yn(e["HP-formula-macro-text"],x,e["npc-hd-misc"],I)).macroText&&C.macroText!==e["HP-formula-macro-text"]&&(k["HP-formula-macro-text"]=C.macroText,k["HP-formula-mod"]=C.macroVal),f=Pn(p,d),k["NPC-HP"]=f,s>0){for(g=0;g<6&&(m=parseInt(e["class-"+g+"-level"],10),h=parseInt(e["class-"+g+"-hp"],10),m||h);g++);g<6?(_=Pn(s,c),k["class-"+g+"-hp"]=_,k["class-"+g+"-level"]=s,k["class-"+g+"-hd"]=c):(n().error("Cannot convert npc class hit dice, the class grid is full! class levels:"+s+", class hit die:"+c),s=0)}l=y+s+p,(u=v+f+_)!==v&&(k["total-hp"]=u),l!==y&&(k.level=l)}catch(e){n().error("PFMigrate.MigrateNPC",e)}finally{k.migrated_npc=1,Va.size(k)>0?Ja(k,o.silentParams,t):t()}}))}(i))}catch(e){n().error("PFMigrate.migrateNPC",e),a()}}))}function er(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=Va.after(5,(function(){Ja({migrated_abilityflags109:1},o.silentParams,t)}));getAttrs(["migrated_abilityflags109","uses_feats","uses_traits","use_racial_traits","use_class_features","use_npc-spell-like-abilities"],(function(e){parseInt(e.migrated_abilityflags109,10)?t():(getSectionIDs("repeating_npc-spell-like-abilities",(function(e){e&&Va.size(e)>0?Ja({"use_npc-spell-like-abilities":1},o.silentParams,a):Ja({"use_npc-spell-like-abilities":0},o.silentParams,a)})),getSectionIDs("repeating_feat",(function(e){e&&Va.size(e)>0?Ja({use_feats:1},o.silentParams,a):Ja({use_feats:0},o.silentParams,a)})),getSectionIDs("repeating_class-ability",(function(e){e&&Va.size(e)>0?Ja({use_class_features:1},o.silentParams,a):Ja({use_class_features:0},o.silentParams,a)})),getSectionIDs("repeating_trait",(function(e){e&&Va.size(e)>0?Ja({use_traits:1},o.silentParams,a):Ja({use_traits:0},o.silentParams,a)})),getSectionIDs("repeating_racial-trait",(function(e){e&&Va.size(e)>0?Ja({use_racial_traits:1},o.silentParams,a):Ja({use_racial_traits:0},o.silentParams,a)})))}))}function tr(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));t>1.18&&a(),getAttrs(["spellclass-0-spell-points-class","spellclass-0-spell-points-bonus","spellclass-0-spell-points-misc","spellclass-1-spell-points-class","spellclass-1-spell-points-bonus","spellclass-1-spell-points-misc","spellclass-2-spell-points-class","spellclass-2-spell-points-bonus","spellclass-2-spell-points-misc","use_spell_points"],(function(e){(parseInt("spellclass-0-spell-points-class",10)||parseInt("spellclass-0-spell-points-bonus",10)||parseInt("spellclass-0-spell-points-misc",10)||parseInt("spellclass-1-spell-points-class",10)||parseInt("spellclass-1-spell-points-bonus",10)||parseInt("spellclass-1-spell-points-misc",10)||parseInt("spellclass-2-spell-points-class",10)||parseInt("spellclass-2-spell-points-bonus",10)||parseInt("spellclass-2-spell-points-misc",10))&&!parseInt(e.use_spell_points,10)?Ja({uses_spell_points:1},o.silentParams,a):a()}))}function ar(e){var t=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["migrated_whispers","PC-whisper","NPC-whisper"],(function(e){var a={};try{parseInt(e.migrated_whispers,10)||(("&nbsp;
      "===e["PC-whisper"]||" "===e["PC-whisper"]||e["PC-whisper"]&&"/w gm"!==e["PC-whisper"])&&(a["PC-whisper"]=""),("&nbsp;
      "===e["NPC-whisper"]||" "===e["NPC-whisper"]||e["NPC-whisper"]&&"/w gm"!==e["NPC-whisper"])&&(a["NPC-whisper"]=""))}catch(e){n().error("PFMigrate.migrateWhispers",e)}finally{Va.size(a)?Ja(a,o.silentParams,t):t()}}))}function nr(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));Qn((function(){Jn(a)})),getAttrs(["migrated_rolltemplateimages","header_image-pf_spell","header_image-pf_attack-melee","header_image-pf_attack-ranged","header_image-pf_attack-cmb","header_image-pf_defense"],(function(e){var t=parseInt(e.migrated_rolltemplateimages,10)||0,a={};try{t||(a=Va.chain(e).filter((function(e,t){return/\[default\]/.test(e)})).reduce((function(e,t,a){var r="";try{switch(a){case"header_image-pf_spell":"[default](http://imgur.com/9yjOsAD.png)"!==t&&(r="[default](http://imgur.com/9yjOsAD.png)");break;case"header_image-pf_attack-melee":"[default](http://i.imgur.com/AGq5VBG.png)"!==t&&(r="[default](http://i.imgur.com/AGq5VBG.png)");break;case"header_image-pf_attack-ranged":"[default](http://imgur.com/58j2e8P.png)"!==t&&(r="[default](http://imgur.com/58j2e8P.png)");break;case"header_image-pf_attack-cmb":"[default](http://imgur.com/RUJfMGe.png)"!==t&&(r="[default](http://imgur.com/RUJfMGe.png)");break;case"header_image-pf_defense":"[default](http://imgur.com/02fV6wh.png)"!==t&&(r="[default](http://imgur.com/02fV6wh.png)")}r&&(e[a]=r)}catch(e){n().error("migrateRollTemplateImages: inner error on "+a,e)}return e}),{}).value())}catch(e){n().error("migrateRollTemplateImages outer error",e)}finally{Va.size(a)>0&&(a.migrated_rolltemplateimages=1,Ja(a,o.silentParams))}})),er(),tr(null,t),ar()}function rr(e){return(e=e||{}).classSkillsMigrated=1,e.spellranges_migrated=1,e["migrated_damage-multiplier"]=1,e.migrated_experience=1,e.migrated_spellflag=1,e.migrated_npc=1,e.migrated_worn_equipment=1,e.migrated_repeating_item_attributes=1,e.migrated_hp_misc=1,e.migrated_maxskill_misc=1,e.migrated_featurelists_defaults=1,e.migrated_attacklist_defaults111=1,e.migrated_itemlist_defaults=1,e.migrated_abilityflags109=1,e.migrated_whispers=1,e.migrated_linked_attacks=1,e.migrated_buffs_rangeddmg_ability=1,e.migrated_itemlist_newfields=1,e.migrate_fatigued_conditions=1,e.migrated_attack_bab_dropdowns=1,e.migrated_skill_dropdowns5=1,e}var ir={melee_notes:" {
         {
          melee_notes=REPLACE
        }
        
      }
      ",ranged_notes:" {
         {
          ranged_notes=REPLACE
        }
        
      }
      ",CMB_notes:" {
         {
          CMB_notes=REPLACE
        }
        
      }
      ",attack_notes:" {
         {
          attack_notes=REPLACE
        }
        
      }
      ",header_image:" {
         {
          header_image=REPLACE
        }
        
      }
      "},sr={notes:{melee:"@ {
        melee-attack-notes
      }
      ",ranged:"@ {
        ranged-attack-notes
      }
      ",CMB:"@ {
        CMB-notes
      }
      ",attack:"@ {
        attack-notes
      }
      ",dual:"@ {
        melee-attack-notes
      }
      "},image:{melee:"@ {
        header_image-pf_attack-melee
      }
      ",ranged:"@ {
        header_image-pf_attack-ranged
      }
      ",CMB:"@ {
        header_image-pf_attack-cmb
      }
      ",dual:"@ {
        header_image-pf_attack-dual
      }
      "}},cr=["toggle_attack_melee_notes","toggle_attack_ranged_notes","toggle_attack_CMB_notes","toggle_attack_attack_notes","toggle_attack_header_image"],or=["attack-type","damage-ability","damage-dice-num","damage-die","damage","attack"],lr=[""],ur=or.concat(lr),pr=Va.map(ur,(function(e){return"_"+e})),dr={attackOptionEventsPlayer:or,attackOptionEventsAuto:lr};function fr(e,t,a){var n=vn(a[e+"attack-type"]),r=vn(a[e+"damage-ability"]),i=" {
         {
          buff_note=@ {
            buff_attack_notes
          }
          
        }
        
      }
        {
         {
          condition_note=@ {
            condition_attack_notes
          }
          
        }
        
      }
      ";return"dual"===n||n||a[e+"attack"]?n&&("dual"!==n&&(n=n.replace("attk-","").replace("2","")||""),t["show"+n.toLowerCase()]&&(i+=" ",i+=ir[n+"_notes"].replace("REPLACE",sr.notes[n])||"")):i+="  {
         {
          no_attack_roll=1
        }
        
      }
      ",t.showheader_image&&(i+=" ",i+=ir.header_image.replace("REPLACE",sr.image[n||"melee"])||""),"dual"===n||r||a[e+"damage"]||parseInt(a[e+"damage-dice-num"],10)&&parseInt(a[e+"damage-die"],10)||(i+="  {
         {
          no_damage=1
        }
        
      }
      "),t.showattack&&(i+=" ",i+=ir.attack_notes.replace("REPLACE",sr.notes.attack)||""),i}function mr(e,t,a){var n=Va.once((function(){"function"==typeof a&&a()})),r="repeating_weapon_"+gn(e),i=Va.map(ur,(function(e){return r+e})),s=cr;(s=s.concat(i)).push(r+"macro_options"),getAttrs(s,(function(e){var t,a=Va.reduce(cr,(function(t,a){return t["show"+a.toLowerCase().slice(14).replace("_notes","")]=parseInt(e[a],10)||0,t}),{}),i={};(t=fr(r,a,e)||"")!==e[r+"macro_options"]&&(i[r+"macro_options"]=t),Va.size(i)>0?Ja(i,o.silentParams,n):n()}))}function _r(e,t,a){var n=Va.once((function(){"function"==typeof a&&a()}));e&&Va.size(e)?getAttrs(cr,(function(t){var a,r=Va.reduce(cr,(function(e,a){return e["show"+a.toLowerCase().slice(14).replace("_notes","")]=parseInt(t[a],10)||0,e}),{});a=(a=bn(["repeating_weapon_"],e,pr)).concat(bn(["repeating_weapon_"],e,["_macro_options"])),getAttrs(a,(function(t){var a=Va.reduce(e,(function(e,a){var n="repeating_weapon_"+a+"_",i="";try{(i=fr(n,r,t))!==t[n+"macro_options"]&&(e[n+"macro_options"]=i)}finally{return e}}),{});Va.size(a)?Ja(a,o.silentParams,n):n()}))})):n()}function gr(e,t){getSectionIDs("repeating_weapon",(function(t){_r(t,0,e)}))}var br=n().callback((function(e){gr(e)}));Va.each(cr,(function(e){on("change:"+e,n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),gr(null))})))})),Va.each(dr.attackOptionEventsAuto,(function(e){on("change:repeating_weapon:"+e,n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),mr(null))})))})),Va.each(dr.attackOptionEventsPlayer,(function(e){on("change:repeating_weapon:"+e,n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),mr(null))})))}));var hr={"class-ability":{name:"original-class-features-list",section:"class-ability",useshowinmenu:1},feat:{npcMacroName:"NPC-feat",npcName:" ^ {
        npc
      }
       ",name:"original-feats-list",section:"feat",npcLinkField:"npc-roll",useshowinmenu:1},"racial-trait":{npcMacroName:"NPC-racial-trait",npcName:" ^ {
        npc
      }
       ",name:"original-racial-traits-list",section:"racial-trait",npcLinkField:"npc-roll",useshowinmenu:1},trait:{name:"original-traits-list",section:"trait",useshowinmenu:1},"mythic-ability":{name:"mythic-abilities",section:"mythic-ability",useshowinmenu:1},"mythic-feat":{name:"mythic-feats",section:"mythic-feat",useshowinmenu:1},"npc-spell-like-abilities":{name:"original-spell-like-abilities-list",section:"npc-spell-like-abilities",useshowinmenu:1},ability:{npcMacroName:"NPC-ability",npcName:" ^ {
        npc
      }
       ",name:"abilities",section:"ability",groupBy:"rule_category",translateGroup:1,npcLinkField:"npc-roll",useshowinmenu:1},ex:{npcMacroName:"NPC-ex",npcName:" ^ {
        npc
      }
       ",name:"extraordinary-abilities-menu",section:"ability",filterField:"ability_type",filterValue:"Ex",groupBy:"frequency",translateGroup:1,altUsesField:"rounds_between",npcLinkField:"npc-roll",useshowinmenu:1},sp:{npcMacroName:"NPC-sp",npcName:" ^ {
        npc
      }
       ",name:"spell-like-abilities-menu",section:"ability",filterField:"ability_type",filterValue:"Sp",groupBy:"frequency",translateGroup:1,altUsesField:"rounds_between",npcLinkField:"npc-roll",useshowinmenu:1},su:{npcMacroName:"NPC-su",npcName:" ^ {
        npc
      }
       ",name:"supernatural-abilities-menu",section:"ability",filterField:"ability_type",filterValue:"Su",groupBy:"frequency",translateGroup:1,altUsesField:"rounds_between",npcLinkField:"npc-roll",useshowinmenu:1},item:{npcMacroName:"NPC-item",npcName:" ^ {
        npc
      }
       ",name:"items",section:"item",usesField:"",bonusField:"",groupBy:"equip-type",translateGroup:1,npcLinkField:"npc-roll",useshowinmenu:1},attacks:{macroSuffix:"-macro",npcMacroSuffix:"-macro-npc",npcName:" ^ {
        npc
      }
       ",section:"weapon",name:"attacks",usesField:"",bonusField:"",groupBy:"attack-type",altGroupBy:"group",translateGroup:1,npcLinkField:"attack-npc-roll",linkField:"attack-roll"}};function yr(e,t,a,r,i){var s=Va.once((function(){"function"==typeof a&&a()})),c={},l=e;try{if(c={usesField:"used",linkField:"roll",nameField:"name",bonusField:"ability_type",translateBonus:1,macroSuffix:"_buttons_macro"},!hr[e])return n().error("PFMenus.resetOneCommandMacro Could not find parameters for menu "+e),void s();c=Va.extend(c,hr[e]),t?(hr[e].npcLinkField&&(c.linkField=hr[e].npcLinkField),hr[e].npcMacroName&&(l=hr[e].npcMacroName),hr[e].npcMacroSuffix&&(c.macroSuffix=hr[e].npcMacroSuffix)):c.npcName&&(c.npcName=""),i&&c.groupBy&&(c.groupMap=i),c.origMacroAttr=l+c.macroSuffix,function(e,t,a){var r=function(e,a){"function"==typeof t&&t(e,a)},i="name",s="",c="",o="",l="",u="",p="roll",d="",f="& {
        template:REPLACETEMPLATE
      }
       @ {
        toggle_attack_accessible
      }
       @ {
        toggle_rounded_flag
      }
        {
         {
          font=@ {
            apply_specfont_chat
          }
          @ {
            use_specfont
          }
          
        }
        
      }
        {
         {
          font=@ {
            apply_specfont_chat
          }
          @ {
            use_specfont
          }
          
        }
        
      }
        {
         {
          scroll_desc=@ {
            scroll-desc
          }
          
        }
        
      }
        {
         {
          color=@ {
            rolltemplate_color
          }
          
        }
        
      }
        {
         {
          header_image=@ {
            REPLACEHEADER
          }
          
        }
        
      }
        {
         {
          character_name=@ {
            character_name
          }
          
        }
        
      }
        {
         {
          character_id=@ {
            character_id
          }
          
        }
        
      }
        {
         {
          subtitle=REPLACESUBTITLE
        }
        
      }
        {
         {
          name=REPLACENPC^ {
            REPLACENAME
          }
          
        }
        
      }
      ",m="  {
         {
          description=^ {
            none-available
          }
           
        }
        
      }
      ";if(!e||!e.section||!e.linkField)return n().error("PFMenus.getRepeatingCommandMacro cannot process",e),void r("");try{a=a||"",f=(f=(f=(f=(f=f.replace("REPLACETEMPLATE",e.template||"pf_block")).replace("REPLACEHEADER",e.header||"header_image-pf_block")).replace("REPLACENAME",e.name||"ability-menus")).replace("REPLACESUBTITLE","")).replace(/REPLACENPC/g,e.npcName||""),f+=a,i=e.nameField||i,s=e.bonusField||s,c=e.usesField||c,p=e.linkField||p,l=e.groupBy||l,d=e.filterField||d,o=e.altUsesField||o,u=e.altGroupBy||""}catch(t){return n().error("PFMenus.getRepeatingCommandMacro outererror for "+e.section,t),void r("")}getSectionIDs("repeating_"+e.section,(function(t){var a=[],_="repeating_"+e.section+"_";try{if(!t||Va.size(t)<=0)return void r(f+m);Va.each(t,(function(t){var n=_+t+"_";a.push(n+i),e.useshowinmenu&&a.push(n+"showinmenu"),u&&a.push(n+u),s&&a.push(n+s),c&&(a.push(n+c),a.push(n+c+"_max")),d&&a.push(n+d),l&&a.push(n+l),o&&a.push(n+o)}))}catch(t){return n().error("PFMenus.getRepeatingCommandMacro outerError2. While assembling all attrs in rows for "+e.section,t),void r("")}a.push("_reporder_repeating_"+e.section),e.origMacroAttr&&a.push(e.origMacroAttr),getAttrs(a,(function(a){var i,g,b="",h=20,y="";try{e.origMacroAttr&&(y=a[e.origMacroAttr]||""),a["_reporder_repeating_"+e.section]?(g=a["_reporder_repeating_"+e.section].split(","),g=Va.map(g,(function(e){return e.toLowerCase()})),i=Va.intersection(Va.union(g,t),t)):i=t,b=Va.chain(i).map((function(t){var r=_+t+"_",i="",f="",m="",g="",b="",h=0,y={id:t,name:a[r+"name"]||t,showinmenu:1};try{if(c&&(m=a[r+c]||"",g=a[r+c+"_max"]||""),u&&a[r+u])y.group=a[r+u],y.doNotTranslate=!0;else if(l&&a[r+l])if(e.groupMap)e.groupMap[a[r+l]]?y.group=e.groupMap[a[r+l]]:y.group="AAAAAA";else if("frequency"===l)switch(a[r+l]){case"perday":y.group="",g&&(y.group=g+" "),y.group+=(e.translateGroup?"^ {
        ":"")+a[r+l]+(e.translateGroup?"
      }
      ":""),y.doNotTranslate=1;break;case"not-applicable":y.group="AAAAAA",m=0,g=0;break;case"constant":case"atwill":y.group=a[r+l],m=0,g=0;break;case"hexfreq":case"other":default:y.group=a[r+l];break;case"everyrounds":y.group=a[r+l],a[r+o]&&(m=a[r+o],g=0)}else y.group=a[r+l];else y.group="AAAAAA";"AAAAAA"!==y.group&&e.translateGroup&&!y.doNotTranslate&&(y.group="^ {
        "+y.group+"
      }
      "),c&&(m&&g?b=" ("+m+"/"+g+")":m&&(b=" ("+m+")")),d?e.filterValue?String(a[r+d])===String(e.filterValue)?y.showinmenu=1:y.showinmenu=0:y.showinmenu=parseInt(a[r+d],10)||0:y.showinmenu=1,"showinmenu"!==y.filterField&&e.useshowinmenu&&(h=parseInt(a[r+"showinmenu"],10)||0,y.showinmenu=y.showinmenu&&h),f=s&&a[r+s]&&"not-applicable"!==a[r+s]&&"0"!=a[r+s]?" ("+(e.translateBonus?"^ {
        ":"")+a[r+s]+(e.translateBonus?"
      }
      ":"")+")":"",i=y.name+f+b,y.chatLink="["+dn(fn(i))+"](~@ {
        character_id
      }
      |"+r+p+")"}catch(e){n().error("PFMenus.getRepeatingCommandMacro builderr object for id "+t,e)}finally{return y}})).filter((function(e){return e.showinmenu})).sortBy("group"),"frequency"===l&&(b=b.reverse()),b=b.groupBy("group").reduce((function(e,t,a){try{"AAAAAA"!==a&&Va.size(t)>0&&(e+="  {
         {
          row"+String(h)+"="+dn(a)+"
        }
        
      }
      ",h++),e+=Va.reduce(t,(function(e,t){return e+" "+t.chatLink}),"  {
         {
          row"+String(h)+"=")+"
        }
        
      }
      ",h++}catch(e){n().error("PFMenus.getRepeatingCommandMacro strerror creating string for group "+a,e)}finally{return e}}),"").value()}catch(t){n().error("PFMenus.getRepeatingCommandMacro innererror2 for "+e.section,t)}finally{r(b?f+b:f+m,y)}}))}))}(c,(function(e,t){var a={};t&&e===t?s():(a[l+c.macroSuffix]=e||"",Ja(a,o.silentParams,s))}),r)}catch(e){n().error("PFMenus.resetOnceCommandMacro, errouter :",e)}}on("change:unchained_skills-show change:bg-skill-use change:is_npc ",(function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),getAttrs(["allmenus_macro","is_npc","unchained_skills-show","BG-Skill-Use"],(function(e){var t={},a=parseInt(e["unchained_skills-show"]),r=parseInt(e["BG-Skill-Use"]),i=" {
         {
          row07=[^ {
            combat-skills
          }
          ](~@ {
            character_id
          }
          |combat_skills) 
        }
        
      }
        {
         {
          row08=[^ {
            all-skills
          }
          ](~@ {
            character_id
          }
          |skills) 
        }
        
      }
       ",s=" {
         {
          row09=[^ {
            items
          }
          ](~@ {
            character_id
          }
          |items) 
        }
        
      }
       @ {
        allspells_macro
      }
       @ {
        allcustom_macro
      }
      ",c=" {
         {
          row07=[^ {
            skills
          }
          ](~@ {
            character_id
          }
          |NPC-skills) 
        }
        
      }
       ",o=" {
         {
          row08=[^ {
            items
          }
          ](~@ {
            character_id
          }
          |NPC-items) 
        }
        
      }
       @ {
        NPC-allspells_macro
      }
       @ {
        NPC-allcustom_macro
      }
      ";parseInt(e.is_npc)?(a&&1===r&&(c=" {
         {
          row07=[^ {
            adventure
          }
          ](~@ {
            character_id
          }
          |NPC-adventure_skills) 
        }
        
      }
        {
         {
          row08=[^ {
            background
          }
          ](~@ {
            character_id
          }
          |NPC-background_skills) 
        }
        
      }
       ",o=" {
         {
          row09=[^ {
            items
          }
          ](~@ {
            character_id
          }
          |NPC-items) 
        }
        
      }
       @ {
        NPC-allspells_macro
      }
       @ {
        NPC-allcustom_macro
      }
      ",n().debug("~~~ NPC w/Background Skills Enabled")),a&&0===r&&(c=" {
         {
          row07=[^ {
            consolidated
          }
          ](~@ {
            character_id
          }
          |NPC-consolidated_skills) 
        }
        
      }
       ",o=" {
         {
          row08=[^ {
            items
          }
          ](~@ {
            character_id
          }
          |NPC-items) 
        }
        
      }
       @ {
        NPC-allspells_macro
      }
       @ {
        NPC-allcustom_macro
      }
      ",n().debug("~~~ NPC w/Consolidated Skills Enabled")),t["NPC-allmenus_macro"]="& {
        template:pf_block
      }
       @ {
        toggle_accessible_flag
      }
       @ {
        toggle_rounded_flag
      }
        {
         {
          font=@ {
            apply_specfont_chat
          }
          @ {
            use_specfont
          }
          
        }
        
      }
        {
         {
          scroll_desc=@ {
            scroll-desc
          }
          
        }
        
      }
        {
         {
          color=@ {
            rolltemplate_color
          }
          
        }
        
      }
        {
         {
          header_image=@ {
            header_image-pf_defense
          }
          
        }
        
      }
        {
         {
          character_name=@ {
            character_name
          }
          
        }
        
      }
        {
         {
          character_id=@ {
            character_id
          }
          
        }
        
      }
        {
         {
          name=^ {
            all
          }
          
        }
        
      }
        {
         {
          row01=[^ {
            init-speed-info-abbrv
          }
          ](~@ {
            character_id
          }
          |init-speed-info) 
        }
        
      }
        {
         {
          row02=[^ {
            abilities
          }
          ](~@ {
            character_id
          }
          |NPC-abilities) 
        }
        
      }
        {
         {
          row03=[^ {
            ability-checks
          }
          ](~@ {
            character_id
          }
          |NPC-ability_checks) 
        }
        
      }
        {
         {
          row04=[^ {
            initiative
          }
          ](~@ {
            character_id
          }
          |NPC-Initiative-Roll) 
        }
        
      }
        {
         {
          row05=[^ {
            defenses
          }
          ](~@ {
            character_id
          }
          |NPC-defenses) 
        }
        
      }
        {
         {
          row06=[^ {
            attacks
          }
          ](~@ {
            character_id
          }
          |NPC-attacks) 
        }
        
      }
       ".concat(c,o)):(a&&1===r&&(i=" {
         {
          row07=[^ {
            adventure
          }
          ](~@ {
            character_id
          }
          |adventure_skills) 
        }
        
      }
        {
         {
          row08=[^ {
            background
          }
          ](~@ {
            character_id
          }
          |background_skills) 
        }
        
      }
       ",n().debug("~~~ PC w/Background Skills Enabled")),a&&0===r&&(i=" {
         {
          row07=[^ {
            consolidated
          }
          ](~@ {
            character_id
          }
          |consolidated_skills) 
        }
        
      }
       ",s=" {
         {
          row08=[^ {
            items
          }
          ](~@ {
            character_id
          }
          |items) 
        }
        
      }
       @ {
        allspells_macro
      }
       @ {
        allcustom_macro
      }
      ",n().debug("~~~ PC w/Consolidated Skills Enabled")),t.allmenus_macro="& {
        template:pf_block
      }
       @ {
        toggle_accessible_flag
      }
       @ {
        toggle_rounded_flag
      }
        {
         {
          font=@ {
            apply_specfont_chat
          }
          @ {
            use_specfont
          }
          
        }
        
      }
        {
         {
          scroll_desc=@ {
            scroll-desc
          }
          
        }
        
      }
        {
         {
          color=@ {
            rolltemplate_color
          }
          
        }
        
      }
        {
         {
          header_image=@ {
            header_image-pf_defense
          }
          
        }
        
      }
        {
         {
          character_name=@ {
            character_name
          }
          
        }
        
      }
        {
         {
          character_id=@ {
            character_id
          }
          
        }
        
      }
        {
         {
          name=^ {
            all
          }
          
        }
        
      }
        {
         {
          row01=[^ {
            init-speed-info-abbrv
          }
          ](~@ {
            character_id
          }
          |init-speed-info) 
        }
        
      }
        {
         {
          row02=[^ {
            initiative
          }
          ](~@ {
            character_id
          }
          |Roll-for-initiative) 
        }
        
      }
        {
         {
          row03=[^ {
            ability-checks
          }
          ](~@ {
            character_id
          }
          |ability_checks) 
        }
        
      }
        {
         {
          row04=[^ {
            abilities
          }
          ](~@ {
            character_id
          }
          |abilities) 
        }
        
      }
        {
         {
          row05=[^ {
            defenses
          }
          ](~@ {
            character_id
          }
          |defenses) 
        }
        
      }
        {
         {
          row06=[^ {
            attacks
          }
          ](~@ {
            character_id
          }
          |attacks) 
        }
        
      }
       ".concat(i,s)),setAttrs(t,{silent:!0})}))}));var vr={melee:{size:"size",atk:"attk-melee",buff:"buff_Melee-total",buff2:"",pen:"condition-Prone",abilityMod:"melee-ability-mod",miscmacro:"attk-melee-misc",misc:"attk-melee-misc-mod",crit:"attk_melee_crit_conf",critconfirm:"buff_crit_conf-total",attackmacro:"@ {
        toggle_global_melee_macro_insert
      }
      ",damagemacro:"@ {
        toggle_global_melee_damage_macro_insert
      }
      ",babdd:"melee_bab",bab:"melee_bab-mod"},melee2:{size:"size",atk:"attk-melee2",buff:"buff_Melee-total",buff2:"buff_melee2-total",pen:"condition-Prone",abilityMod:"melee2-ability-mod",miscmacro:"attk-melee2-misc",misc:"attk-melee2-misc-mod",crit:"attk_melee2_crit_conf",critconfirm:"buff_crit_conf-total",attackmacro:"@ {
        toggle_global_melee_macro_insert
      }
      ",damagemacro:"@ {
        toggle_global_melee_damage_macro_insert
      }
      ",babdd:"melee2_bab",bab:"melee2_bab-mod"},ranged:{size:"size",atk:"attk-ranged",buff:"buff_Ranged-total",buff2:"",pen:"",abilityMod:"ranged-ability-mod",miscmacro:"attk-ranged-misc",misc:"attk-ranged-misc-mod",crit:"attk_ranged_crit_conf",critconfirm:"buff_crit_conf-total",attackmacro:"@ {
        toggle_global_ranged_macro_insert
      }
      ",damagemacro:"@ {
        toggle_global_ranged_damage_macro_insert
      }
      ",babdd:"ranged_bab",bab:"ranged_bab-mod"},ranged2:{size:"size",atk:"attk-ranged2",buff:"buff_Ranged-total",buff2:"buff_ranged2-total",pen:"",abilityMod:"ranged2-ability-mod",miscmacro:"attk-ranged2-misc",misc:"attk-ranged2-misc-mod",crit:"attk_ranged2_crit_conf",critconfirm:"buff_crit_conf-total",attackmacro:"@ {
        toggle_global_ranged_macro_insert
      }
      ",damagemacro:"@ {
        toggle_global_ranged_damage_macro_insert
      }
      ",babdd:"ranged2_bab",bab:"ranged2_bab-mod"},CMB:{size:"CMD-size",atk:"CMB",buff:"buff_CMB-total",buff2:"",pen:"",abilityMod:"CMB-ability-mod",miscmacro:"attk-CMB-misc",misc:"attk-CMB-misc-mod",crit:"attk_cmb_crit_conf",critconfirm:"buff_crit_conf-total",attackmacro:"@ {
        toggle_global_cmb_macro_insert
      }
      ",damagemacro:"@ {
        toggle_global_cmb_damage_macro_insert
      }
      ",babdd:"cmb_bab",bab:"cmb_bab-mod"},CMB2:{size:"CMD-size",atk:"CMB2",buff:"buff_CMB-total",buff2:"buff_cmb2-total",pen:"",abilityMod:"CMB2-ability-mod",miscmacro:"attk-CMB2-misc",misc:"attk-CMB2-misc-mod",crit:"attk_cmb2_crit_conf",critconfirm:"buff_crit_conf-total",attackmacro:"@ {
        toggle_global_cmb_macro_insert
      }
      ",damagemacro:"@ {
        toggle_global_cmb_damage_macro_insert
      }
      ",babdd:"cmb2_bab",bab:"cmb2_bab-mod"}},kr=["condition-Dazzled","condition-Entangled","condition-Grappled","condition-Fear","condition-Sickened","woundsPenaltyTotal"],wr=["attk-penalty"].concat(["acp-attack-mod","condition-Drained"]),Ar={0:"none","@ {
        attk-melee
      }
      ":"melee","@ {
        attk-melee2
      }
      ":"melee","@ {
        attk-ranged
      }
      ":"ranged","@ {
        attk-ranged2
      }
      ":"ranged2","@ {
        CMB
      }
      ":"combat-maneuver-bonus-abbrv","@ {
        CMB2
      }
      ":"combat-maneuver-bonus-abbrv"};function Cr(e,t,a){var n=Va.once((function(){"function"==typeof e&&e()}));pn(wr,0,kr,!1,n,t),getAttrs(["condition-Entangled","condition-Fatigued","condition-Exhausted","condition-Invisible","condition_attack_notes","condition-Grappled","condition-Pinned"],(function(e){var t="",a={};parseInt(e["condition-Entangled"],10)?(t+="**"+Qa("entangled")+"**: ",t+=Qa("condition-nocharge-note")+"\r\n"):parseInt(e["condition-Fatigued"],10)?(t+="**"+Qa("fatigued")+"**: ",t+=Qa("condition-nocharge-note")+"\r\n"):parseInt(e["condition-Exhausted"],10)&&(t+="**"+Qa("exhausted")+"**: ",t+=Qa("condition-nocharge-note")+"\r\n"),parseInt(e["condition-Invisible"],10)&&(t+="**"+Qa("invisible")+"**: ",t+=Qa("condition-invisible-title")+"\r\n"),parseInt(e["condition-Grappled"],10)&&(t+="**"+Qa("grappled")+"**: ",t+=Qa("condition-grappled-cmb-note")+"\r\n"),t!==e.condition_attack_notes&&(a.condition_attack_notes=t,Ja(a,o.silentParams))}))}function Ir(e,t,a){var r=0,i=0;try{a=a||{},r=t[vr[e].atk],i=t[vr[e].bab]+t["attk-penalty"]+t[vr[e].abilityMod]+t[vr[e].misc]+t[vr[e].size]+t[vr[e].buff]+t["buff_attack-total"],vr[e].pen&&(i-=t[vr[e].pen]),vr[e].buff2&&(i+=t[vr[e].buff2]),i!==r&&(a[vr[e].atk]=i)}catch(e){n().error("PFAttackGrid.updateAttack",e)}finally{return a}}function xr(e,t,a){var r,i=Va.once((function(){"function"==typeof t&&t()}));vr[e]?(r=function(e){var t=[];return vr[e]&&(t=Va.chain(vr[e]).values().flatten().compact().uniq().reject((function(e){return e.indexOf("macro")>=0})).value().sort()),t.push("attk-penalty"),t.push("buff_attack-total"),t}(e),r.push("attk-penalty"),r.push("buff_attack-total"),getAttrs(r,(function(r){var i={},s={},c={};try{i=Va.reduce(r,(function(e,t,a){return e[a]=parseInt(t,10)||0,e}),{}),s=Ir(e,i)}catch(t){n().error("PFAttackGrid.updateAttack for "+e,t)}finally{Va.size(s)?(a&&(c=o.silentParams),Ja(s,c,t)):"function"==typeof t&&t()}}))):(n().error("PFAttackGrid.updateAttack attack grid fields do not exist for: "+e),i())}function Pr(e,t,a,r){var i,s;try{a?(s=Va.intersection(Object.keys(vr),a),Va.size(s)!==Va.size(a)&&n().warn("Error in parameters, some of these are not valid attacks:",a)):(a=Object.keys(vr),s=a),i=function(e){var t,a=[];return t=Va.intersection(Object.keys(vr),e),(a=Va.chain(t).map((function(e){return Va.values(vr[e])})).flatten().compact().uniq().reject((function(e){return e.indexOf("macro")>=0})).value().sort()).push("attk-penalty"),a.push("buff_attack-total"),a}(a)}catch(t){return n().error("PFAttackGrid.updateAttacks error creating list of fields for ",a,t),void("function"==typeof e&&e())}getAttrs(i,(function(a){var r={},i={},c={};try{r=Va.reduce(a,(function(e,t,a){return e[a]=parseInt(t,10)||0,e}),{}),i=Va.reduce(s,(function(e,t){return e=Ir(t,r,e)}),{})}catch(e){n().error("PFAttackGrid.updateAttacks ",e)}finally{Va.size(i)?(t&&(c=o.silentParams),n().debug("PFAttackGrid.updateAttacks setting",i),Ja(i,c,e)):"function"==typeof e&&e()}}))}function Sr(e,t,a){switch(e.toLowerCase()){case"melee":Pr(null,a,["melee","melee2"]);break;case"ranged":Pr(null,a,["ranged","ranged2"]);break;case"cmb":Pr(null,a,["CMB","CMB2"]);break;case"melee2":xr("melee2",null,a);break;case"ranged2":xr("ranged2",null,a);break;case"cmb2":xr("CMB2",null,a)}}function Tr(e){var t=Va.after(2,(function(){"function"==typeof e&&e()}));yr("attacks",!1,t," @ {
        attacks_header_macro
      }
      ",Ar),yr("attacks",!0,t," @ {
        NPC-attacks_header_macro
      }
      ",Ar)}function Er(e,t,a){var n,r="";a&&(n=[r=a.sourceAttribute],n=Object.keys(vr).reduce((function(e,t){return e.push(t),e.push(vr[t].babdd),e.push(vr[t].bab),e}),n),getAttrs(n,(function(t){var a,n={},i={};a=parseInt(t[r],10)||0,Object.keys(vr).filter((function(e){return(t[vr[e].babdd]||"").toLowerCase()===r.toLowerCase()})).forEach((function(e){var r,s;r=parseInt(t[vr[e].bab],10)||0,(s=a-r)&&(i[vr[e].bab]=a,n[e]=(parseInt(t[e],10)||0)+s)})),Va.size(i)&&Ja(i,o.silentParams),Va.size(n)?Ja(n,{},e):"function"==typeof e&&e()})))}function Dr(e,t){!function(e){getAttrs(["migrated_attack_bab_dropdowns","bab"],(function(t){var a={},n=0;parseInt(t.migrated_attack_bab_dropdowns,10)?"function"==typeof e&&e():(n=parseInt(t.bab,10)||0,a.melee_bab="bab",a["melee_bab-mod"]=n,a.melee2_bab="bab",a["melee2_bab-mod"]=n,a.ranged_bab="bab",a["ranged_bab-mod"]=n,a.ranged2_bab="bab",a["ranged2_bab-mod"]=n,a.cmb_bab="bab",a["cmb_bab-mod"]=n,a.cmb2_bab="bab",a["cmb2_bab-mod"]=n,a.migrated_attack_bab_dropdowns=1,Ja(a,o.silentParams,e))}))}(e)}var Mr=n().callback((function(e,t,a){var r=function(){n().info("leaving PFAttackGrid.recalculate"),"function"==typeof e&&e()},i=Va.once((function(){Pr(r,t)}));Dr(Va.once((function(){Cr(i,t)})))}));Va.each(vr,(function(e,t){on("change:"+e.miscmacro,n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),sn(null,null,e.miscmacro,e.misc,e.atk)}))),on("change:"+e.babdd,n().callback((function(t){var a,r,i,s,c,o;"player"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),a=e.babdd,r=e.bab,i=e.atk,getAttrs([a,r,i],(function(e){var t="";try{(t=cn(e[a],s))?getAttrs([t],(function(a){ln(parseInt(a[t],10)||0,r,parseInt(e[r],10)||0,i,parseInt(e[i],10)||0,c,o)})):ln(t,r,parseInt(e[r],10)||0,i,parseInt(e[i],10)||0,c,o)}catch(t){n().error("SWUtils.setDropdownAndAddToTot for read:"+a+",write:"+r+",tot:"+i,e,t),"function"==typeof c&&c()}})))}))),on("change:"+e.bab+" change:"+e.abilityMod+" change:"+e.misc,n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),xr(t))}))),on("change:"+e.size,n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Mr())}))),on("change:"+e.size,n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Mr())})))})),on("change:attk-penalty",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Pr(null,null,null))}))),on("change:acp-attack-mod change:condition-wounds change:wounds_gritty_mode change:has_endurance_feat change:wound_threshold-show",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["condition-Wounds","wounds_gritty_mode","has_endurance_feat","wound_threshold-show","woundsPenaltyTotal"],(function(e){var t=An(parseInt(e["condition-Wounds"],10)||0,parseInt(e.has_endurance_feat,10)||0,parseInt(e.wounds_gritty_mode,10)||0),a=(parseInt(e["wound_threshold-show"],10)||0)*t;setAttrs({woundsPenaltyTotal:Math.abs(a)}),Mr()})),Cr()}))),on("change:class-0-level change:class-1-level change:class-2-level change:class-3-level change:class-4-level change:class-5-level",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||Er(null,0,e)}))),on("change:bab",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Er(null,0,e)})));var Fr=["Appraise","Acrobatics","Bluff","Climb","Diplomacy","Disable-Device","Disguise","Escape-Artist","Fly","Handle-Animal","Heal","Intimidate","Linguistics","Perception","Ride","Sense-Motive","Sleight-of-Hand","Spellcraft","Stealth","Survival","Swim","Use-Magic-Device"],Nr=["Appraise","Handle-Animal","Linguistics","Sleight-of-Hand"],Rr=["Acrobatics","Bluff","Climb","Diplomacy","Disable-Device","Disguise","Escape-Artist","Fly","Heal","Intimidate","Perception","Ride","Sense-Motive","Spellcraft","Stealth","Survival","Swim","Use-Magic-Device"],zr=Nr.concat(["Knowledge-Engineering","Knowledge-Geography","Knowledge-History","Knowledge-Nobility"]).sort(),Lr=Rr.concat(["Knowledge-Arcana","Knowledge-Dungeoneering","Knowledge-Local","Knowledge-Nature","Knowledge-Planes","Knowledge-Religion"]).sort(),Or=["","2","3","4","5","6","7","8","9","10"],qr=["-0","-1","-2","-3","-4","-5","-6","-7","-8","-9"],Hr=["Craft","Misc-Skill","Perform","Profession"],Br=["Artistry","Lore"],Ur=Hr.concat(Br).concat(["CS-Misc-Skill"]).sort(),jr=bn(Br,Or),Wr=["Arcana","Dungeoneering","Engineering","Geography","History","Local","Nature","Nobility","Planes","Religion"],Gr=Hr.concat(["Knowledge"]).sort(),Xr=Ur.concat(["Knowledge"]).sort(),Vr=Va.map(Wr,(function(e){return"-"+e})),$r=Va.reduce(Xr,(function(e,t){return e[t]=bn([t],Or),e}),{}),Kr=zr.concat($r.Craft).concat($r.Perform).concat($r.Profession).concat(["Misc-Skill-5","Misc-Skill-6","Misc-Skill-7","Misc-Skill-8","Misc-Skill-9"]).sort(),Yr=Lr.concat(["Misc-Skill-0","Misc-Skill-1","Misc-Skill-2","Misc-Skill-3","Misc-Skill-4"]).sort(),Zr=["-ReqTrain","-ranks"],Jr="& {
        template:pf_generic
      }
       @ {
        toggle_accessible_flag
      }
       @ {
        toggle_rounded_flag
      }
        {
         {
          font=@ {
            apply_specfont_chat
          }
          @ {
            use_specfont
          }
          
        }
        
      }
        {
         {
          scroll_desc=@ {
            scroll-desc
          }
          
        }
        
      }
        {
         {
          color=@ {
            rolltemplate_color
          }
          
        }
        
      }
        {
         {
          header_image=@ {
            header_image-pf_generic-skill
          }
          
        }
        
      }
        {
         {
          character_name=@ {
            character_name
          }
          
        }
        
      }
        {
         {
          character_id=@ {
            character_id
          }
          
        }
        
      }
        {
         {
          subtitle
        }
        
      }
       ",Qr={Fly:1,Stealth:2,"CS-Stealth":2},ei=Va.map(Wr,(function(e){return e.toLowerCase()})),ti=["disable device","escape artist","sense motive","handle animal","use magic device","sleight of hand"],ai=Va.map(Wr,(function(e){return"Knowledge-"+e})),ni=(Kr.concat(jr).sort(),Yr.concat(Kr).sort()),ri=["CS-Acrobatics","CS-Athletics","CS-Finesse","CS-Influence","CS-Nature","CS-Perception","CS-Performance","CS-Religion","CS-Society","CS-Spellcraft","CS-Stealth","CS-Survival"],ii=["CS-Misc-Skill-0","CS-Misc-Skill-1","CS-Misc-Skill-2","CS-Misc-Skill-3","CS-Misc-Skill-4","CS-Misc-Skill-5","CS-Misc-Skill-6","CS-Misc-Skill-7","CS-Misc-Skill-8","CS-Misc-Skill-9"],si=Fr.concat(ai).concat(ri).sort(),ci=bn(["Craft","Perform","Profession","Artistry","Lore"],Or),oi=bn(["Misc-Skill"],qr).concat(ii),li=ci.concat(oi).sort(),ui=si.concat(li).sort(),pi={Acrobatics:"dex",Appraise:"int",Bluff:"cha",Climb:"str",Craft:"int",Diplomacy:"cha","Disable-Device":"dex",Disguise:"cha","Escape-Artist":"dex",Fly:"dex","Handle-Animal":"cha",Heal:"wis",Intimidate:"cha","Knowledge-Arcana":"int","Knowledge-Dungeoneering":"int","Knowledge-Engineering":"int","Knowledge-Geography":"int","Knowledge-History":"int","Knowledge-Local":"int","Knowledge-Nature":"int","Knowledge-Nobility":"int",Knowledge:"int","Knowledge-Planes":"int","Knowledge-Religion":"int",Linguistics:"int",Perception:"wis",Perform:"cha",Profession:"wis",Ride:"dex","Sense-Motive":"wis","Sleight-of-Hand":"dex",Spellcraft:"int",Stealth:"dex",Survival:"wis",Swim:"str","Use-Magic-Device":"cha"},di={"CS-Acrobatics":"dex","CS-Athletics":"str","CS-Finesse":"dex","CS-Influence":"cha","CS-Nature":"int","CS-Perception":"wis","CS-Performance":"cha","CS-Religion":"int","CS-Society":"int","CS-Spellcraft":"int","CS-Stealth":"dex","CS-Survival":"wis"},fi=["enforce_requires_training","size_skill","size_skill_double","acp","Phys-skills-cond","Perception-cond","STR-mod","DEX-mod","CON-mod","INT-mod","WIS-mod","CHA-mod","buff_STR_skills-total","buff_DEX_skills-total","buff_CON_skills-total","buff_INT_skills-total","buff_WIS_skills-total","buff_CHA_skills-total","checks-cond","buff_Check-total","buff_check_skills-total"],mi=["","-cs","-ranks","-ability","-racial","-trait","-feat","-item","-misc-mod","-ReqTrain","-ut"],_i={skillGlobalPhysEventAuto:"change:phys-skills-cond change:acp",skillEventsAuto:"change:REPLACE-misc-mod",skillEventsPlayer:"change:REPLACE-ability change:REPLACE-ranks change:REPLACE-racial change:REPLACE-trait change:REPLACE-feat change:REPLACE-item change:REPLACE-ReqTrain"};function gi(e,t){return Va.reduce(e,(function(e,a){var n=bn([a],"Misc-Skill"===a||"CS-Misc-Skill"===a?qr:"Knowledge"===a?Vr:Or,t);return e.concat(n)}),[])}function bi(e,t){var a=Va.once((function(){"function"==typeof t&&t()}));getAttrs(["total-skill","total-fcskill","INT-mod","level","Max-Skill-Ranks-mod","Max-Skill-Ranks","unchained_skills-show","BG-Skill-Use","npc-skill","npc-hd-num","class-0-skill","class-1-skill","class-2-skill","class-3-skill","class-4-skill","class-5-skill","class-0-level","class-1-level","class-2-level","class-3-level","class-4-level","class-5-level"],(function(e){var t=parseInt(e["INT-mod"],10)||0,r=(parseInt(e["total-skill"],10),parseInt(e.level,10)||0),i=parseInt(e["total-fcskill"],10)||0,s=parseInt(e["Max-Skill-Ranks-mod"],10)||0,c=parseInt(e["Max-Skill-Ranks"],10)||0,o=0,l=0,u=0,p=0,d=0,f=0,m={};try{for(1===parseInt(e["unchained_skills-show"],10)&&0===(parseInt(e["BG-Skill-Use"],10)||0)&&(f=1),o=0;o<6;o++)(l=parseInt(e["class-"+o+"-level"],10)||0)>0&&((p=(parseInt(e["class-"+o+"-skill"],10)||0)*l+t*l)<l&&(p=l),u+=p);l=parseInt(e["npc-hd-num"],10)||0,p=parseInt(e["npc-skill"],10)||0,l&&p&&((p=l*p+t*l)<l&&(p=l),u+=p),f&&(u=Math.floor(u/2)),(d=u+s)<r&&(d=r),c!==(d+=i)&&(m["Max-Skill-Ranks"]=d)}catch(e){n().error("PFSkills.updateMaxSkills",e)}finally{Va.size(m)>0?Ja(m,{silent:!0},a):a()}}))}function hi(e,t){var a="",r=!1,i=!1,s=!1,c=["BG-Skill-Use","unchained_skills-show"];try{e&&"function"==typeof t&&("cs-"===(a=e.slice(0,4).toLowerCase()).slice(0,3)?!0:"arti"===a||"lore"===a?i=!0:r=!0,Va.contains(li,e)&&(s=!0,c=c.concat([e+"-name",e+"-ranks"])),getAttrs(c,(function(a){var n=!1,c=parseInt(a["BG-Skill-Use"],10)||0,o=parseInt(a["unchained_skills-show"],10)||0;(!s||a[e+"-name"]||(parseInt(a[e+"-ranks"],10)||0)>0)&&(r?o&&!c||(n=!0):i?o&&c&&(n=!0):o&&!c&&(n=!0)),t(n)})))}catch(e){n().error("PFSkills.verifyHasSkill",e),t(!1)}}function yi(e,t,a){var r=0,i=(parseInt(t.enforce_requires_training,10),e+"-ranks"),s=e+"-ability",c=e+"-racial",o=e+"-trait",l=e+"-feat",u=e+"-item",p=e+"-misc-mod",d=e+"-ut",f=e+"-ReqTrain",m=0,_=parseInt(t[e+"-cs"],10)||0,g=parseInt(t[e],10),b=parseInt(t[i],10)||0,h=parseInt(t[f],10)||0,y=0,v="",k="",w=0,A=0;try{a=a||{},v=t[s],h&&0===b?" {
         {
          untrained=1
        }
        
      }
      "!==t[d]&&(a[d]=" {
         {
          untrained=1
        }
        
      }
      "):" {
         {
          untrained=
        }
        
      }
      "!==t[d]&&(a[d]=" {
         {
          untrained=
        }
        
      }
      "),b&&_&&(m+=3),"DEX-mod"!==v&&"STR-mod"!==v||(m+=parseInt(t.acp,10)||0,w=parseInt(t["Phys-skills-cond"],10)||0),v&&(k=v.slice(0,3).toUpperCase(),y+=parseInt(t["buff_"+k+"_skills-total"],10)||0),(r="Stealth"===e||"CS-Stealth"===e?2:"Fly"===e?1:0)&&(1===r?m+=parseInt(t.size_skill,10)||0:2===r&&(m+=parseInt(t.size_skill_double,10)||0)),"Perception"!==e&&"CS-Perception"!==e||(A=parseInt(t["Perception-cond"],10)||0),g!==(m+=b+(0+w+A+((parseInt(t["checks-cond"],10)||0)+(parseInt(t["buff_Check-total"],10)||0)+(parseInt(t["buff_check_skills-total"],10)||0)))+y+(parseInt(t[v],10)||0)+(parseInt(t[c],10)||0)+(parseInt(t[o],10)||0)+(parseInt(t[l],10)||0)+(parseInt(t[u],10)||0)+(parseInt(t[p],10)||0))&&(a[e]=m)}catch(e){n().error("PFSkills.setNewSkillVal",e)}finally{return a}}function vi(e,t,a){var r=function(e,a){"function"==typeof t&&t(e,a)},i=mi.map((function(t){return e+t}));i=i.concat(fi),getAttrs(i,(function(t){var a={},i=0;try{i=parseInt(t[e],10),a=yi(e,t,a)}catch(e){n().error(e)}finally{Va.size(a)>0?Ja(a,o.silentParams,(function(){r(a[e],i)})):r(i,i)}}))}function ki(e,t,a){var n,r=Va.once((function(){"function"==typeof t&&t()}));n=fi,Va.each(e,(function(e){var t=mi.map((function(t){return e+t}));n=n.concat(t)})),getAttrs(n,(function(t){var a;a=Va.reduce(e,(function(e,a){try{yi(a,t,e)}catch(e){}finally{return e}}),{}),Va.size(a)?Ja(a,o.silentParams,r):r()}))}function wi(e,t,a){var n=Va.once((function(){"function"==typeof t&&t()}));Va.size(e);!function(e,t){var a=Va.after(Va.size(e),t);Va.each(e,(function(e){an(e+"-misc",e+"-misc-mod",0,(function(){a()}),!0)}))}(e,(function(){ki(e,n)}))}function Ai(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["unchained_skills-show","BG-Skill-Use"],(function(e){try{parseInt(e["unchained_skills-show"],10)?parseInt(e["BG-Skill-Use"],10)?a?(ki(jr,null),ki(ni,r)):(wi(jr,null),wi(ni,r)):a?(ki(ri,r),ki(ii,null)):(wi(ri,r),wi(ii,null)):a?ki(ni,r):wi(ni,r)}catch(e){n().error("PFSKills.recalculate",e),r()}}))}function Ci(e,t){n().notice("PFSkills updateallskills diff updating by "+e+", from "+t),getAttrs(ui,(function(a){var r,i=e-t;r=Va.mapObject(a,(function(e,t){return(parseInt(e,10)||0)+i})),n().debug("SPSkills.updateAllSkillsDiff setting",r),Ja(r,o.silentParams)}))}function Ii(e,t,a,r){var i,s,c,o=function(){"function"==typeof a&&a()},l="";e?l=e:t&&(l=t.sourceAttribute).indexOf("repeating_")>=0&&(l=_n(l)),l&&("physical"===l||"acp"===l?i=/STR\-mod|DEX\-mod/:(s=l.match(/str|dex|con|int|wis|cha/i))&&(i=new RegExp(s[0].toUpperCase()+"-mod"))),i?(c=ui.map((function(e){return e+"-ability"})),getAttrs(c,(function(e){var t;t=Va.reduce(e,(function(e,t,a){return i.test(t)&&e.push(a.slice(0,-8)),e}),[]),n().notice("PFSkills updateAbilityBasedSkills getting array:",t),Va.size(t)?ki(t,o):o()}))):o()}function xi(e,t,a,n,r,i){var s=r?" {
         {
          name=^ {
            npc
          }
           ^ {
            REPLACELOWER
          }
           ^ {
            skills
          }
           
        }
        
      }
       ":" {
         {
          name=^ {
            REPLACELOWER
          }
           ^ {
            skills
          }
           
        }
        
      }
       ",c=r?"NPC-":"",l=function(e){var t="[^ {
        REPLACENAME
      }
      "+(e?"+ @ {
        REPLACE
      }
      ":"")+"](~@ {
        character_id
      }
      |"+c+"REPLACE-check) ";return s.replace("REPLACELOWER","knowledge")+" {
         {
           "+Va.reduce(ei,(function(e,a,n){return e+=t.replace(/REPLACENAME/g,a).replace(/REPLACE/g,ai[n])}),"")+" 
        }
        
      }
      "},u=e?Ur:Hr,p=gi(u,["-name"]);t&&(p=(p=p.concat(gi(u,Zr))).sort()),getAttrs(p,(function(e){var a={},r="";Va.each(u,(function(r){var o=function(e,t,a){var n=bn([e],"Misc-Skill"===e||"CS-Misc-Skill"===e?qr:"Knowledge"===e?Vr:Or),r=[];return"Knowledge"===e?r=n:(r=Va.filter(n,(function(e){return!!a[e+"-name"]})),t?Va.filter(r,(function(e){return 0===(parseInt(a[e+"-ReqTrain"],10)||0)||(parseInt(a[e+"-ranks"],10)||0)>0})):r)}(r,t,e),u=function(e,t,a,n){var r=e.toLowerCase(),i=a?"+ @ {
        REPLACE
      }
      ":"",o=s.replace("REPLACELOWER",r),u="[REPLACENAME"+i+"](~@ {
        character_id
      }
      |"+c+"REPLACE-check) ",p="";return"Knowledge"===e?l():((p=Va.reduce(t,(function(e,t,a){var r=n[t+"-name"];return r=r?dn(r=fn(r)):"@ {
        "+t+"-name
      }
      ",e+u.replace(/REPLACENAME/g,r).replace(/REPLACE/g,t)}),""))||(p="description = ^ {
        no-skills-available
      }
      "),o+" {
         {
           "+p+" 
        }
        
      }
      ")}(r,o,i,e);u=Jr+u,n[c+r.toLowerCase()+"_skills-macro"]!==u&&(a[c+r.toLowerCase()+"_skills-macro"]=u)})),n[c+"knowledge_skills-macro"]&&(r=Jr+l(i),n[c+"knowledge_skills-macro"]!==r&&(a[c+"knowledge_skills-macro"]=r)),Va.size(a)>0&&Ja(a,o.silentParams)}))}function Pi(e,t,a){return t?Va.filter(e,(function(e){return!!(/^Knowled|^Linguis|^Sleight/i.test(e.slice(0,7))||1!==(parseInt(a[e+"-ReqTrain"],10)||0)||(parseInt(a[e+"-ranks"],10)||0)>0)})):e}function Si(e,t,a,n){var r=e.toLowerCase(),i=n?"NPC-":"",s="[^ {
        REPLACELOWER
      }
      "+(a?" + @ {
        REPLACE
      }
      ":"")+"](~@ {
        character_id
      }
      |"+i+"REPLACE-check) ",c="[^ {
        REPLACELOWER
      }
      ](~@ {
        character_id
      }
      |"+i+"REPLACELOWERMAC_skills_buttons_macro) ",o=n?" {
         {
          name= ^ {
            npc
          }
           ^ {
            "+r+"
          }
           
        }
        
      }
       ":" {
         {
          name= ^ {
            "+r+"
          }
           
        }
        
      }
       ",l="";try{(l=Va.reduce(t,(function(e,t,a){var n=t.toLowerCase(),r=Va.contains(Xr,t)?c:s;return e+=(r=(r=(r=r.replace(/REPLACELOWERMAC/g,n)).replace(/REPLACELOWER/g,n)).replace(/REPLACE/g,t))+" "}),""))||(l="^ {
        no-skills-available
      }
       ")}finally{return o+" {
         {
           "+l+"
        }
        
      }
      "}}function Ti(e,t,a,r,i,s,c,l){var u=Va.once((function(){"function"==typeof e&&e()})),p=a?"NPC-":"";getAttrs([p+"skills-macro",p+"background_skills-macro",p+"adventure_skills-macro",p+"artistry_skills-macro",p+"lore_skills-macro",p+"craft_skills-macro",p+"knowledge_skills-macro",p+"perform_skills-macro",p+"profession_skills-macro",p+"misc-skill_skills-macro",p+"CS-misc-skill_skills-macro"],(function(e){var t={},i=[];c?(i=ri,getAttrs(bn(i,["-ReqTrain","-ranks"]),(function(e){var t,n,s={};(t=Pi(i,l,e)).push("CS-Misc-Skill"),n=Si("consolidated-skills",t,r,a),s[p+"consolidated_skills-macro"]=Jr+n,Ja(s,o.silentParams,u)}))):(xi(s,l,0,e,a,r),getAttrs(bn(Fr,Zr),(function(e){var i=[],c="",d=[];try{s?(i=Pi(Nr,l,e)||[],d=d.concat(i),i=i.concat(Xr).sort(),c=Jr+Si("background-skills",i,r,a),e[p+"background_skills-macro"]!==c&&(t[p+"background_skills-macro"]=c),i=Pi(Rr,l,e)||[],d=d.concat(i),i=i.concat(["Knowledge","Misc-Skill"]).sort(),c=Jr+Si("adventure-skills",i,r,a),e[p+"adventure_skills-macro"]!==c&&(t[p+"adventure_skills-macro"]=c),d=d.concat(Xr).sort()):(i=Pi(Fr,l,e)||[],d=d.concat(i).concat(Gr).sort()),c=Jr+Si("skills",d,r,a),e[p+"skills-macro"]!==c&&(t[p+"skills-macro"]=c)}catch(e){n().error("PFSkills.resetOneCommandMacro errRT",e)}finally{Va.size(t)>0?Ja(t,o.silentParams,u):u()}})))}))}function Ei(e,t){var a=Va.once((function(){"function"==typeof t&&t()}));getAttrs(["BG-Skill-Use","unchained_skills-show","enforce_requires_training","is_npc","include_skill_totals"],(function(e){var t=parseInt(e.is_npc,10)||0,n=parseInt(e.include_skill_totals,10)||0,r=parseInt(e["unchained_skills-show"],10)||0,i=r&&(parseInt(e["BG-Skill-Use"],10)||0),s=r&&!i,c=parseInt(e.enforce_requires_training,10)||0;Ti(a,0,t,n,0,i,s,c),t&&Ti(a,0,!1,n,0,i,s,c)}))}function Di(e,t){var a=Va.once((function(){"function"==typeof e&&e()})),r=Va.after(4,a);!function(e){var t=function(){"function"==typeof e&&e()};getAttrs(["migrated_take10_dropdown","skill-query","investigator_dice","skill-invest-query"],(function(e){var a={};0===(parseInt(e.migrated_take10_dropdown,10)||0)?("? {
        Roll or Take 10/20?|1d20,1d20+@ {
          skill-invest-query&#125;
          |10,10+@ {
            skill-invest-query&#125;
            |20,20+@ {
              skill-invest-query&#125;
              
            }
            "===e["skill-query"]?a["skill-query"]="? {
              Roll or Take 10/20?|1d20,1d20|10,10|20,20
            }
            +@ {
              skill-invest-query
            }
            ":"@ {
              skill-invest-query
            }
            "===e["skill-query"]?a["skill-query"]="@ {
              skill-invest-query
            }
            +@ {
              custom_dice
            }
            ":e["skill-query"]&&"0"!==e["skill-query"]?"@ {
              skill-invest-query
            }
            +@ {
              custom_dice
            }
            "!==e["skill-query"]&&"? {
              Roll or Take 10/20?|1d20,1d20|10,10|20,20
            }
            +@ {
              skill-invest-query
            }
            "!==e["skill-query"]&&"1d20+@ {
              skill-invest-query
            }
            "!==e["skill-query"]&&(a["skill-query"]="1d20+@ {
              skill-invest-query
            }
            "):a["skill-query"]="1d20+@ {
              skill-invest-query
            }
            ","0"!==e.investigator_dice&&e.investigator_dice||(a.investigator_dice="[[ 1d6 ]] [custom bonus]"),e["skill-invest-query"]?"@ {
              investigator_dice
            }
            "!==e["skill-invest-query"]&&"0"!==e["skill-invest-query"]&&(a["skill-invest-query"]="0"):a["skill-invest-query"]="0",a.migrated_take10_dropdown=1,Ja(a,o.silentParams,t)):t()}))}(r),function(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=function(e){e.forEach((function(e){!function(e){var t=e+"-cs";getAttrs([t],(function(e){var a={};isNaN(parseInt(e[t],10))&&e[t]&&"0"!=e[t]&&(a[t]=3,Ja(a,o.silentParams))}))}(e)}))};getAttrs(["classSkillsMigrated"],(function(e){parseInt(e.classSkillsMigrated,10)||(a(ui),Ja({classSkillsMigrated:1},o.silentParams,t)),t()}))}(r),function(e){getAttrs(["migrated_skill_speedup3"],(function(t){var a;1*t.migrated_skill_speedup3&&"function"==typeof e&&e(),a=ui.map((function(e){return e+"-macro"})),getAttrs(a,(function(t){var a={};try{a=Va.reduce(t,(function(e,t,a){try{e[a]=t.replace(/ \+ \[\[ @{checks\-cond} \+ @{buff_check_skills-total} \+ @{buff_Check-total} \]\]  /,"")}catch(e){n().error("PFBuffs.migrate add buff checks for "+a,e)}finally{return e}}),{})}catch(e){n().error("PFSkills.migrate skill speedup",e)}finally{a.migrated_skill_speedup3=1,setAttrs(a,o.silentParams,e)}}))}))}(r),function(e){Zn(e,"migrated_maxskill_misc","Max-Skill-Ranks-Misc","Max-Skill-Ranks-mod","","Max-Skill-Ranks-Misc2")}(r)}var Mi=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFSkills.recalculate"),Ei(),"function"==typeof e&&e()}));Di((function(){bi(),Ai(r)}))}));on("change:str-mod change:dex-mod change:con-mod change:int-mod change:wis-mod change:cha-mod",n().callback((function(e){n().notice("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Ii(null,e)}))),on("change:total-skill change:total-fcskill change:int-mod change:level change:max-skill-ranks-mod change:unchained_skills-show change:BG-Skill-Use",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||bi()}))),on(_i.skillGlobalPhysEventAuto,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event for "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Ii("physical",e)}))),Va.each(ui,(function(e){on(_i.skillEventsAuto.replace(/REPLACE/g,e),n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event for "+e+", "+t.sourceType),"sheetworker"!==t.sourceType&&"api"!==t.sourceType||hi(e,(function(a){a&&vi(e,t)}))}))),on(_i.skillEventsPlayer.replace(/REPLACE/g,e),n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event for "+e+", "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||vi(e)}))),on("change:"+e+"-misc",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||an(e+"-misc",e+"-misc-mod",0),n().debug("calling evalute for "+e),sn(null,null,e+"-misc",e+"-misc-mod",e)}))),on("change:"+e+"-cs",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||function(e){getAttrs([e,e+"-ranks",e+"-cs"],(function(t){var a,n,r=0,i={};a=parseInt(t[e],10)||0,n=parseInt(t[e+"-cs"],10)||0,parseInt(t[e+"-ranks"],10)&&(r=n?a+3:a-3,i[e]=r,Ja(i))}))}(e)}))),"Knowledge"!==e.slice(0,9)&&"Linguistics"!==e&&"Sleight-of-Hand"!==e&&on("change:"+e+"-ReqTrain change:"+e+"-ranks",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event for "+e+", "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||getAttrs(["enforce_requires_training"],(function(e){parseInt(e.enforce_requires_training,10)&&Ei()}))})))})),Va.each(Qr,(function(e,t){1===e?on("change:size_skill",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),vi(t))}))):2===e&&on("change:size_skill_double",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||vi(t)})))})),on("change:enforce_requires_training",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Ei())}))),Va.each(bn(li,["-name"]),(function(e){on("change:"+e,n().callback((function(t){if("player"===t.sourceType||"api"===t.sourceType){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType);var a=e.slice(0,-4)+"ReqTrain",r=e.slice(0,-4)+"ranks";getAttrs(["enforce_requires_training",a,r,"unchained_skills-show","BG-Skill-Use","artistry_skills-macro","lore_skills-macro","craft_skills-macro","knowledge_skills-macro","perform_skills-macro","profession_skills-macro","misc-skill_skills-macro","is_npc","include_skill_totals","NPC-craft_skills-macro","NPC-knowledge_skills-macro","NPC-perform_skills-macro","NPC-profession_skills-macro","NPC-misc-skill_skills-macro"],(function(e){var t=parseInt(e.enforce_requires_training,10),n=parseInt(e.is_npc,10)||0,i=parseInt(e.include_skill_totals,10)||0;t&&parseInt(e[a],10)&&isNaN(parseInt(e[r],10))||xi(n?0:parseInt(e["unchained_skills-show"],10)&&parseInt(e["BG-Skill-Use"],10)||0,t,0,e,n,i)}))}})))})),on("change:unchained_skills-show change:BG-Skill-Use change:include_skill_totals",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||Mi(e,(function(){Ei()}))})));var Fi={"AC-ability":"AC-ability-mod","FF-ability":"FF-DEX","CMD-ability1":"CMD-STR","CMD-ability2":"CMD-DEX","CMD-ability":"FF-CMD-DEX"},Ni={"ac-ability":"AC-ability","ff-ability":"FF-ability","cmd-ability1":"CMD-ability1","cmd-ability2":"CMD-ability2","cmd-ability":"CMD-ability"},Ri=["armor3","shield3"],zi=["equipped","acbonus","enhance","max-dex","acp","spell-fail","proficiency","type"],Li=bn(Ri,["-"],zi).concat(["acp","max-dex","AC-armor","AC-shield","spell-fail","acp-attack-mod","max-dex-source","current-load"]),Oi="change:bab change:ac-penalty change:cmd-penalty change:size change:ac-shield change:ac-armor change:ac-ability-mod change:ff-dex change:cmd-dex change:ff-cmd-dex change:cmd-str change:max-dex change:ac-misc-mod change:cmd-misc-mod",qi="change:ff-dex change:ac-penalty change:cmd-penalty change:size change:ac-dodge change:ac-natural change:ac-deflect",Hi="change:size change:AC-ability change:FF-ability change:CMD-ability1 change:CMD-ability2 change:CMD-ability";function Bi(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["AC-ability-mod","FF-DEX","AC-penalty","CMD-penalty","size","max-dex","AC-dodge","AC-natural","AC-deflect","AC-misc-mod","buff_AC-total","buff_Touch-total","buff_CMD-total","CMD-DEX","FF-CMD-DEX","CMD-STR","bab","CMD-misc-mod","AC","Touch","Flat-Footed","CMD","FF-CMD","AC-ability","FF-ability","CMD-ability","CMD-ability1","CMD-ability2","AC-armor","AC-shield","condition-Blinded","condition-Pinned","condition-Stunned","condition-Cowering","condition-Drained","condition-Flat-Footed","AC-ability-display","FF-DEX-display","CMD-DEX-display","FF-CMD-DEX-display","maxdex-toggle","nodex-toggle","uncanny_dodge","unlock_def_ability","hd_not_bab","level","buff_armor-total","buff_shield-total","buff_flat-footed-total","buff_natural-total","buff_dodge-total","buff_deflection-total","buffsumac","buffsumtouch","buffsumff","buffsumcmd","buffsumffcmd ","current-load","max-dex-source","buff_ffCMD-nododge"],(function(e){var a=parseInt(e.size,10)||0,i=parseInt(e["AC-dodge"],10)||0,s=parseInt(e["AC-deflect"],10)||0,c=parseInt(e["AC-misc-mod"],10)||0,l=parseInt(e["AC-penalty"],10)||0,u=parseInt(e["buff_AC-total"],10)||0,p=parseInt(e["buff_Touch-total"],10)||0,d=parseInt(e["buff_CMD-total"],10)||0,f=parseInt(e["buff_ffCMD-nododge"],10)||0,m=parseInt(e["AC-armor"],10)||0,_=parseInt(e["AC-shield"],10)||0,g=parseInt(e["AC-natural"],10)||0,b=parseInt(e.bab,10)||0,h=parseInt(e["CMD-misc-mod"],10)||0,y=parseInt(e["max-dex"],10),v=parseInt(e["CMD-penalty"],10)||0,k=parseInt(e["condition-Blinded"],10)?1:0,w=parseInt(e["condition-Pinned"],10)?1:0,A=parseInt(e["condition-Stunned"],10)?1:0,C=parseInt(e["condition-Flat-Footed"],10)?1:0,I=parseInt(e["condition-Cowering"],10)?1:0,x=parseInt(e["max-dex-source"],10)||0,P=parseInt(e["current-load"],10)||0,S=0,T=parseInt(e["maxdex-toggle"],10)||0,E=0,D=parseInt(e["nodex-toggle"],10)||0,M=parseInt(e.unlock_def_ability,10)||0,F=M?0:1,N=10,R=10,z=10,L=10,O=10,q=parseInt(e.AC,10),H=parseInt(e.Touch,10),B=parseInt(e["Flat-Footed"],10),U=parseInt(e.CMD,10),j=parseInt(e["FF-CMD"],10),W=parseInt(e.uncanny_dodge,10)||0,G=vn(e["AC-ability"]),X=W?G:vn(e["FF-ability"]),V=F?X:vn(e["CMD-ability"]),$=F?G:vn(e["CMD-ability2"]),K=parseInt(e["AC-ability-mod"],10)||0,Y=parseInt(e["CMD-STR"],10)||0,Z=F?K:parseInt(e["CMD-DEX"],10)||0,J=0,Q=0,ee=0,te=0,ae=parseInt(e["buff_armor-total"],10)||0,ne=parseInt(e["buff_shield-total"],10)||0,re=parseInt(e["buff_natural-total"],10)||0,ie=parseInt(e["buff_flat-footed-total"],10)||0,se=parseInt(e["buff_dodge-total"],10)||0,ce=0,oe=0,le=0,ue=0,pe=0,de=0,fe=0,me={},_e={};try{n().debug("PFDefense.updateDefenses: buffs "+u,e),W?(J=F?K:parseInt(e["FF-DEX"],10)||0,Q=F?K:parseInt(e["FF-CMD-DEX"],10)||0):(K<0&&(J=K),Z<0&&(Q=Z)),(y=isNaN(y)?99:y)<99&&y>=0&&(G==G&&y<K&&(K=y,S=1,F&&W&&(J=y)),M&&($===G&&y<Z&&(S=1),W&&(X===G&&y<J&&(J=y,S=1),V===G&&y<Q&&(S=1)))),k||w||I||A||4===P&&(0===x||2===x)?te=1:(C||3===P&&(0===x||2===x))&&(ee=1),te?(W&&(W=0),E=1,i=0,se=0,K=Math.min(0,K),F?(Z=K,J=K,Q=K):(Z=Math.min(0,Z),J=Math.min(0,J),Q=Math.min(0,Q))):ee&&(W||(i=0,E=1),K=Math.min(K,J),Z=F?K:Math.min(Z,Q)),E&&S&&(S=0),W?(oe=i,le=se):W||(oe=0,le=0),parseInt(e.hd_not_bab,10)&&(b=parseInt(e.level,10)||0),N=10+m+_+g+K+a+s+c+l+i+(ce=u+ae+ne+re+se),R=10+K+a+s+c+l+i+(ue=u+p+se),z=10+m+_+g+J+a+s+c+l+oe+(pe+=u+ae+ne+re+ie+le),L=10+b+Y+Z+-1*a+s+h+v+i+(fe=u+d+se),O=10+b+Y+Q+-1*a+s+h+v+oe+(de+=u+d+ie+le)-(0!==de?f:0),parseInt(e.buffsumac,10)!==ce&&(me.buffsumac=ce),parseInt(e.buffsumtouch,10)!==ue&&(me.buffsumtouch=ue),parseInt(e.buffsumff,10)!==pe&&(me.buffsumff=pe),parseInt(e.buffsumcmd,10)!==fe&&(me.buffsumcmd=fe),parseInt(e.buffsumffcmd,10)!==de&&(me.buffsumffcmd=de),(N!==q||isNaN(q))&&(me.AC=N),(R!==H||isNaN(H))&&(me.Touch=R),(z!==B||isNaN(B))&&(me["Flat-Footed"]=z),(L!==U||isNaN(U))&&(me.CMD=L),(O!==j||isNaN(j))&&(me["FF-CMD"]=O,1),K!==parseInt(e["AC-ability-display"],10)&&(me["AC-ability-display"]=K),J!==parseInt(e["FF-DEX-display"],10)&&(me["FF-DEX-display"]=J),Z!==parseInt(e["CMD-DEX-display"],10)&&(me["CMD-DEX-display"]=Z),Q!==parseInt(e["FF-CMD-DEX-display"],10)&&(me["FF-CMD-DEX-display"]=Q),S!==T&&(me["maxdex-toggle"]=S),E!==D&&(me["nodex-toggle"]=E)}catch(e){n().error("PFDefense.updateDefenses:",e)}finally{Va.size(me)>0?(t&&(_e=o.silentParams),Ja(me,_e,r)):r()}}))}function Ui(e,t,a,r,i){var s=Va.once((function(){"function"==typeof t&&t()})),c=Va.once((function(){i?s():Bi(s,a)})),l="",u="";try{e?(l=e.toLowerCase(),(u=Ni[l])?getAttrs(["unlock_def_ability","uncanny_dodge"],(function(e){parseInt(e.unlock_def_ability,10)||"ac-ability"===l||"cmd-ability1"===l?Bn(u,Fi[u],(function(e,t){e!==t||e<0||t<0||"ff-ability"===l||"cmd-ability"===l?c():s()}),a):s()})):(n().warn("PFDefense.updateDefenses, called with invalid dropdown: "+e),s())):r&&"uncanny_dodge"===r.sourceAttribute&&getAttrs(["unlock_def_ability","uncanny_dodge","AC-ability",Fi["AC-ability"]],(function(t){var a=0,r={};try{parseInt(t.unlock_def_ability,10)||0?(a=parseInt(t["AC-ability"],10)||0,parseInt(t.uncanny_dodge,10)?(r["FF-ability"]=t["AC-ability"],r[Fi["FF-ability"]]=a,r["CMD-ability"]=t["AC-ability"],r[Fi["CMD-ability"]]=a):(r["FF-ability"]="0",r[Fi["FF-ability"]]=0,r["CMD-ability"]="0",r[Fi["CMD-ability"]]=0),Ja(r,o.silentParams,c)):c()}catch(t){n().error("PFDefense.setDefenseDropdownMod inner error for : "+e,t),s()}}))}catch(t){n().error("PFDefense.setDefenseDropdownMod error for: "+e,t),s()}}function ji(e,t,a){var r=function(){"function"==typeof e&&e()};getAttrs(Li,(function(e){var a=0,i=0,s=0,c=0,l=0,u=0,p=0,d=0,f=0,m=0,_=99,g=0,b=0,h=99,y=0,v=0,k=0,w=0,A=parseInt(e["max-dex-source"],10)||0,C=parseInt(e["current-load"],10)||0,I={},x={};try{n().debug("at updateArmor ",e),Ri.forEach((function(t){1===parseInt(e[t+"-equipped"],10)&&(p=parseInt(e[t+"-acbonus"],10)||0,g=parseInt(e[t+"-enhance"],10)||0,m=parseInt(e[t+"-spell-fail"],10)||0,l+=m,t.indexOf("armor")>=0?s+=p+g:c+=p+g,f=parseInt(e[t+"-acp"],10)||0,A<2&&(d=parseInt(e[t+"-max-dex"],10),("-"===e[t+"-max-dex"]||isNaN(d))&&(d=99),_=Math.min(d,_),a+=f),(parseInt(e[t+"-proficiency"],10)||0)&&(u+=f),/tower/i.test(e[t+"-type"])&&(u-=2))})),i=a,0===A||2===A?1===C?(_=Math.min(_,3),i=Math.min(i,-3)):2===C?(_=Math.min(_,1),i=Math.min(i,-6)):C>2&&(_=0,i=Math.min(i,-6)):3===A&&(i=0,a=0),b=parseInt(e.acp,10)||0,h=parseInt(e["max-dex"],10),h=isNaN(h)?99:h,y=parseInt(e["AC-armor"],10)||0,v=parseInt(e["AC-shield"],10)||0,k=parseInt(e["spell-fail"],10)||0,w=parseInt(e["acp-attack-mod"],10)||0,b!==i&&(I.acp=i),h!==_&&(I["max-dex"]=_),y!==s&&(I["AC-armor"]=s),v!==c&&(I["AC-shield"]=c),k!==l&&(I["spell-fail"]=l),w!==u&&(I["acp-attack-mod"]=u)}catch(e){n().error("PFDefense.updateArmor",e)}finally{Va.size(I)>0?(t&&(x=o.silentParams),n().notice("updateArmor setting",I,x),Ja(I,x,r)):r()}}))}function Wi(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["AC-penalty","CMD-penalty","condition-Blinded","condition-Cowering","condition-Stunned","condition-Pinned","condition-Wounds","condition-Drained","has_endurance_feat","wounds_gritty_mode","condition-Grappled","condition-Invisible","condition-Paralyzed","condition-Helpless","condition-Prone","condition_defense_notes"],(function(e){var i=0,s=0,c=0,l=0,u=0,p=0,d=0,f="",m={},_={};try{a&&/grappled|invisible/i.test(a.sourceAttribute)?t=!0:(s=parseInt(e["condition-Drained"],10)||0,c=parseInt(e["condition-Wounds"],10)||0,l=parseInt(e["AC-penalty"],10)||0,u=parseInt(e["CMD-penalty"],10)||0,d=An(c,parseInt(e.has_endurance_feat,10)||0,parseInt(e.wounds_gritty_mode,10)||0),i=-1*((parseInt(e["condition-Blinded"],10)||0)+(parseInt(e["condition-Pinned"],10)||0)+(parseInt(e["condition-Cowering"],10)||0)+(parseInt(e["condition-Stunned"],10)||0)),p=s+(i+=d),l!==i&&(m["AC-penalty"]=i),u!==p&&(m["CMD-penalty"]=p)),parseInt(e["condition-Paralyzed"],10)&&(f+="**"+Qa("paralyzed")+"**: ",f+=Qa("condition-paralyzed-note")+"\r\n"),parseInt(e["condition-Prone"],10)&&(f+="**"+Qa("prone")+"**: ",f+=Qa("condition-prone-note")+"\r\n"),parseInt(e["condition-Helpless"],10)&&(f+="**"+Qa("helpless")+"**: ",f+=Qa("condition-helpless-note")+"\r\n"),parseInt(e["condition-Grappled"],10)&&parseInt(e["condition-Invisible"],10)&&(f+="**"+Qa("grappled")+" + "+Qa("invisible")+"**: ",f+=Qa("condition-grappled-invisible-note")+"\r\n"),f!==e.condition_defense_notes&&(m.condition_defense_notes=f)}catch(e){n().error("PFDefense.applyConditions:",e)}finally{Va.size(m)>0?(t&&(_=o.silentParams),Ja(m,_,r)):r()}}))}function Gi(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));t>0&&t<.5&&getAttrs(["max-dex-source"],(function(e){(parseInt(e["max-dex-source"],10)||0)>=99&&Ja({},{silent:!0})})),t>0&&t<1.2?getAttrs(["CMD-ability2","unlock_def_ability","AC-ability"],(function(e){var t="",r="",i=0,s={};try{t=vn(e["AC-ability"]),r=vn(e["CMD-ability2"]),i=parseInt(e.unlock_def_ability,10)||0,t&&r&&t!==r&&!i?s.unlock_def_ability=1:i&&(s.unlock_def_ability=0)}catch(e){n().error("PFDefense.migrate",e)}finally{Va.size(s)>0?Ja(s,o.silentParams,a):a()}})):a()}var Xi=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFDefense.recalculate"),"function"==typeof e&&e()})),i=Va.size(Fi),s=Va.after(i,(function(){Bi(r,!0)}));Gi((function(){Wi((function(){ji((function(){Va.each(Fi,(function(e,t){Ui(t,s,!0,null,!0)}))}),t)}),t)}),a)}));function Vi(e){return function(e){if(Array.isArray(e))return $i(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return $i(e,t);var a={}.toString.call(e).slice(8,-1);return"Object"===a&&e.constructor&&(a=e.constructor.name),"Map"===a||"Set"===a?Array.from(e):"Arguments"===a||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a)?$i(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function $i(e,t){(null==t||t>e.length)&&(t=e.length);for(var a=0,n=Array(t);a<t;a++)n[a]=e[a];return n}Va.each(Fi,(function(e,t){on("change:"+t,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Ui(t,null,null,e,!1)})))})),on("change:uncanny_dodge",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||Ui(null,null,null,e,!1)}))),on("change:hd_not_bab",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||Bi(null,null)}))),on(Oi,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Bi(null,null)}))),on(qi,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||Bi(null,null)}))),on(Hi,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Bi(null,null)}))),on("change:max-dex-source change:current-load",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),ji(null,null)}))),Va.each(Ri,(function(e){Va.each(zi,(function(t){on("change:"+e+"-"+t,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),ji(null,null)})))}))}));var Ki=["Belt","Body","Chest","Eyes","Feet","Hands","Head","Headband","Neck","Ring1","Ring2","Shoulders","Wrist"],Yi=Ki.concat(["Armor3","Shield3","Armor","Shield"]),Zi=(Va.map(Yi,(function(e){return"worn-"+e})),Va.map(Yi,(function(e){return"worn-"+e+"-roll"}))),Ji=["Carried","NotCarried","Armor","Belt","Body","Chest","Eyes","Feet","Hands","Head","Headband","Neck","Ring1","Ring2","Shield","Shoulders","Wrist"],Qi={Carried:0,NotCarried:1,Armor:2,Belt:3,Body:4,Chest:5,Eyes:6,Feet:7,Hands:8,Head:9,Headband:10,Neck:11,Ring1:12,Ring2:13,Shield:14,Shoulders:15,Wrist:16,equipped:2},es={noEquipType:0,Weapon:1,Armor:2,Ammo:3,Consumables:4,OtherMagic:5,Gear:6,Other:7,Charged:8,Other2:9},ts={0:"",1:"weapons",2:"armor-shield",3:"ammunition",4:"consumables",5:"other-magic-items",6:"gear-tool",7:"other-items",8:"charged-magics",9:"other-items-2"},as={value:1,hp:1,weight:1},ns=["attack-type","range","masterwork","crit-target","crit-multiplier","damage-dice-num","damage-die","damage","precision_dmg_macro","precision_dmg_type","critical_dmg_macro","critical_dmg_type"];function rs(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=Va.after(2,t);yr("item",!0,a,"",ts),yr("item",!1,a,"",ts)}function is(e){var t="";if(isNaN(e)&&null!=e)return"worn-"+e;if(e>1&&Ji[e])try{t="worn-"+Ji[e]}catch(e){n().error("PFInventory.getWornItemNameField",e)}return t}function ss(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));try{a||(a=as),n().repeating("item").attrs("use_metrics","item_total_weight","item-total-hp","item-total-hp_max","item-total-value").fields("item-weight","qty","qty_max","location","item-hp","item-hp_max","value").reduce((function(e,t){try{t.I.qty>0&&(0===t.I.qty_max||1===t.I.qty_max?(a.weight&&t.I.location!==Qi.NotCarried&&(e["item-weight"]+=t.F["item-weight"]*t.F.qty),a.value&&(e.value+=t.F.value*t.F.qty),a.hp&&(e["item-hp"]+=t.I["item-hp"]*t.I.qty,e["item-hp_max"]+=t.I["item-hp_max"]*t.I.qty)):(a.weight&&t.I.location!==Qi.NotCarried&&(e["item-weight"]+=t.F["item-weight"]),a.value&&(e.value+=t.F.value),a.hp&&(e["item-hp"]+=t.I["item-hp"],e["item-hp_max"]+=t.I["item-hp_max"])))}catch(e){n().error("PFInventory.updateRepeatingItems inner error",e)}finally{return e}}),{"item-weight":0,"item-hp":0,"item-hp_max":0,value:0},(function(e,t,n){var r=1;n.use_metrics>0&&(r=.454),a.weight&&(n.S.item_total_weight=Math.floor(e["item-weight"]*r*100)/100),a.hp&&(n.S["item-total-hp"]=e["item-hp"],n.S["item-total-hp_max"]=e["item-hp_max"]),a.value&&(n.S["item-total-value"]=Math.floor(100*e.value)/100)})).execute(r)}catch(e){n().error("PFInventory.updateRepeatingItems",e),r()}}function cs(e,t){var a=function(){"function"==typeof e&&e()};getAttrs(["CP","SP","GP","PP","carried-currency","use_metrics"],(function(e){var r=Number(e["carried-currency"]||0),i={},s=0;try{var c=1;parseInt(e.use_metrics)>0&&(c=.454),s=(parseInt(e.CP,10)||0)+(parseInt(e.SP,10)||0)+(parseInt(e.GP,10)||0)+(parseInt(e.PP,10)||0),n().debug("coin curr="+r+", coin carried="+s),r!==(s=Math.floor(s/50*c*100)/100)?(t&&(i=o.silentParams),Ja({"carried-currency":s},i,a)):a()}catch(e){n().error("PFInventory.updateCarriedCurrency",e),a()}}))}function os(e,t){var a=function(){"function"==typeof e&&e()};getAttrs(["carried-currency","carried-currency-toggle","item_total_weight","carried-misc","carried-total","use_metrics"],(function(e){var t,r,i;try{parseInt(e.use_metrics)>0&&.454,i=parseFloat(e["carried-currency"])||0,0===parseInt(e["carried-currency-toggle"])&&(i=0),t=Math.floor(100*parseFloat(e["carried-total"])||0),r=Math.floor(100*i+100*(parseFloat(e.item_total_weight)||0)+100*(parseFloat(e["carried-misc"])||0)),n().debug("carried curr="+t+", carried total="+r),t!==r?Ja({"carried-total":r/=100},{},a):a()}catch(e){n().error("PFInventory.updateCarriedTotal",e),a()}}))}function ls(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=Va.once((function(){Ja({migrated_worn_equipment:"1"},{},t)})),r=["charges","weight","hp","hp_max","value"],i=function(e,t,a){var r=Va.once((function(e){"function"==typeof a&&a(e)})),i=[e,e+"-type"],s="",c=0;if(/armor/i.test(e))c=1;else{if(!/shield/i.test(e))return void r(0);0}getAttrs([e],(function(a){a[e]?(s=a[e],getSectionIDs("repeating_item",(function(a){var l;l=Va.map(a,(function(e){return"repeating_item_"+e+"_name"})),Va.each(zi,(function(t){i.push(e+"-"+t)})),i=i.concat(l),getAttrs(i,(function(a){var i,u="",p={},d={},f=0,m="",_=!0,g=0,b=0;try{g=parseInt(a[e+"-equipped"],10)||0,f=parseInt(a[e+"-max-dex"],10),isNaN(f)&&(f=99),(i=Va.find(l,(function(e){return s===a[e]})))?(_=!1,u=mn(i)):u=generateRowID(),p["repeating_item_"+u+"_equip-type"]=es.Armor,p["repeating_item_"+u+"_equiptype-tab"]=es.Armor,_&&(p["repeating_item_"+u+"_name"]=s),p["repeating_item_"+u+"_qty"]=1,p["repeating_item_"+u+"_qty_max"]=1,t||1!==g?(p["repeating_item_"+u+"_location"]=Qi.NotCarried,p["repeating_item_"+u+"_old_location"]=Qi.NotCarried,p["repeating_item_"+u+"_loctype-tab"]=Qi.NotCarried,g&&(p[e+"-equipped"]=0)):(b=1,c?(_?(p["repeating_item_"+u+"_location"]=Qi.Armor,p["repeating_item_"+u+"_old_location"]=Qi.Armor):d["repeating_item_"+u+"_location"]=Qi.Armor,p["repeating_item_"+u+"_loctype-tab"]=Qi.equipped,p["armor3-roll"]="@ {
              repeating_item_"+u+"_macro-text
            }
            ",p.armor3=a[e]):(_?(p["repeating_item_"+u+"_location"]=Qi.Shield,p["repeating_item_"+u+"_old_location"]=Qi.Shield):d["repeating_item_"+u+"_location"]=Qi.Shield,p["repeating_item_"+u+"_loctype-tab"]=Qi.equipped,p["shield3-roll"]="@ {
              repeating_item_"+u+"_macro-text
            }
            ",p.shield3=a[e]),f>50&&(p[e+"-max-dex"]="-")),Va.each(["acbonus","enhance","acp","spell-fail","proficiency"],(function(t){(m=a[e+"-"+t])&&(p["repeating_item_"+u+"_item-"+t]=m)})),p["repeating_item_"+u+"_item-max-dex"]=f>50?"-":f,(m=a[e+"-type"])&&(p["repeating_item_"+u+"_item-defense-type"]=m)}catch(e){n().error("PFInventory.copyWornDefenseToNewItem",e)}finally{Va.size(p)>0?Ja(p,o.silentParams,(function(){Va.size(d)>0?Ja(d,{},(function(){r(b)})):r(b)})):r(!1)}}))}))):r(0)}))};getAttrs(["migrated_worn_equipment"],(function(e){var s=!1,c=!1,l=Va.after(2,(function(){a()})),u=function(){n().debug("checking armor3"),i("armor3",s,(function(e){s=s||e,n().debug("checking armor2, found="+s),i("armor2",s,(function(e){s=s||e,n().debug("checking armor0, found="+s),i("armor",s,l)}))})),n().debug("checking shield3"),i("shield3",c,(function(e){c=c||e,n().debug("checking shield2, found="+c),i("shield2",c,(function(e){c=c||e,n().debug("checking shield0, found="+c),i("shield",c,l)}))}))},p=Va.after(Va.size(Ki),(function(){var e;try{e=bn(Va.map(Ki,(function(e){return"worn-"+e+"-"})),["charges","weight","hp","hp_max","value","description","hardness"]),Ja(Va.reduce(e,(function(e,t){return e[t]="",e}),{}),o.silentParams,u)}catch(e){n().error("PFInventory.migrateWornEquipment.doneWornRows err:",e),u()}}));try{if(1===parseInt(e.migrated_worn_equipment,10))return void t();Va.each(Ki,(function(e){!function(e,t){var a=Va.once((function(){"function"==typeof t&&t()})),i=["worn-"+e];i.push("worn-"+e+"-description"),i.push("worn-"+e+"-hardness"),Va.each(r,(function(t){i.push("worn-"+e+"-"+t)})),getAttrs(i,(function(t){var r="",i={},s={},c="",l=0,u=es.noEquipType;try{t["worn-"+e]&&(i["repeating_item_"+(r=generateRowID())+"_name"]=t["worn-"+e],i["repeating_item_"+r+"_row_id"]=r,(c=t["worn-"+e+"-description"])&&(i["repeating_item_"+r+"_short-description"]=c),(c=t["worn-"+e+"-charges"])?(i["repeating_item_"+r+"_qty"]=c,i["repeating_item_"+r+"_qty_max"]=t["worn-"+e+"-charges_max"]||50):(s["repeating_item_"+r+"_qty"]=1,s["repeating_item_"+r+"_qty_max"]=1),(c=t["worn-"+e+"-weight"])&&(s["repeating_item_"+r+"_item-weight"]=c),(c=t["worn-"+e+"-hardness"])&&(s["repeating_item_"+r+"_hardness"]=c),(c=t["worn-"+e+"-hp"])&&(s["repeating_item_"+r+"_item-hp"]=c),(c=t["worn-"+e+"-hp_max"])&&(i["repeating_item_"+r+"_item-hp_max"]=c),(c=t["worn-"+e+"-value"])&&(s["repeating_item_"+r+"_value"]=c),i["worn-"+e+"-roll"]="@ {
              repeating_item_"+r+"_macro-text
            }
            ",l=Qi[e],i["repeating_item_"+r+"_location"]=l,i["repeating_item_"+r+"_old_location"]=l,i["repeating_item_"+r+"loctype-tab"]=l===Qi.NotCarried?Qi.NotCarried:l===Qi.Carried?Qi.Carried:l>Qi.NotCarried?Qi.equipped:-1,u=es.OtherMagic,i["repeating_item_"+r+"_equip-type"]=u,i["repeating_item_"+r+"_equiptype-tab"]=u)}catch(e){n().error("PFInventory.copyWornEquipmentToNewItem",e)}finally{Va.size(i)>0?Ja(i,o.silentParams,a):a(),Va.size(s)>0&&Ja(s)}}))}(e,p)}))}catch(e){n().error("PFInventory.migrateWornEquipment",e),u()}}))}function us(e,t,a,r){var i=Va.once((function(){"function"==typeof t&&t()})),s=(gn(e),e||r&&mn(r.sourceAttribute)||""),c="repeating_item_"+s+"_",l=c+"location",u=c+"loctype-tab",p=c+"name",d=c+"old_location",f=c+"macro-text";try{getAttrs([l,d,p,u],(function(e){var a=0,r=0,c={},m="",_=-1,g="",b={};try{a=parseInt(e[l],10),isNaN(a)&&(a=Qi.NotCarried,c[l]=a),_=parseInt(e[u]),isNaN(_)&&(_=-2),a>Qi.NotCarried?_!==Qi.equipped&&(c[u]=Qi.equipped):a===Qi.Carried?_!==a&&(c[u]=Qi.Carried):a===Qi.NotCarried?_!==a&&(c[u]=Qi.NotCarried):-1!==_&&(c[u]="-1"),r=parseInt(e[d],10),isNaN(r)&&(r=a),c[d]=a,a===Qi.Carried&&r!==Qi.NotCarried&&r!==a?(m=is(r))&&(c[m]="",c[m+"-roll"]=""):a===Qi.NotCarried?((m=is(r))&&(c[m]="",c[m+"-roll"]=""),2===r&&(b["armor3-equipped"]=0),14===r&&(b["shield3-equipped"]=0)):a>Qi.NotCarried&&(m=is(a),n().debug("#####################at set location the new location "+a+","+Ji[a]+" is "+m),m&&(g=e[p]||"",c[m]=g||"Row "+s,c[m+"-roll"]="@ {
              "+f+"
            }
            "),r>1&&r!==a&&(m=is(r))&&(c[m]="",c[m+"-roll"]=""))}catch(e){n().error("updateEquipmentLocation update location error:",e)}finally{Va.size(c)>0?(n().debug("updateEquipmentLocation, setting slot ",c),Ja(c,o.silentParams,(function(){a>Qi.NotCarried&&function(e,t,a){(!a||t<2||!t)&&"function"==typeof e&&e(),getSectionIDs("repeating_item",(function(n){var r=[];Va.size(n)<=1?"function"==typeof e&&e():(Va.each(n,(function(e,t){e!==a&&r.push("repeating_item_"+e+"_location")})),getAttrs(r,(function(a){var r={};Va.each(n,(function(e,n){(parseInt(a["repeating_item_"+e+"_location"],10)||0)===t&&(r["repeating_item_"+e+"_location"]=0,r["repeating_item_"+e+"_old_location"]=0)})),Va.size(r)>0?Ja(r,{silent:!0},e):"function"==typeof e&&e()})))}))}(t,a,s),i()}))):i()}Va.size(b)&&Ja(b,o.silentParams)}))}catch(e){n().error("PFInventory.updateEquipmentLocation",e),i()}}function ps(e,t,a){var r=Va.once((function(){"function"==typeof a&&a()})),i="",s="",c="",l=[],u="",p="",d="";try{s=_n(t),u=mn(t),"_"!==(d="repeating_item_"+u+"_").slice(-1)&&(d+="_"),p=is(e),c=d+"item-",i=e===Qi.Armor?"armor3":"shield3",l=Va.map(["item-acbonus","item-acenhance","item-max-dex","item-acp","item-spell-fail","item-defense-type","item-proficiency","name","set-as-armor","set-as-shield","location","old_location","equip-type","acenhance"],(function(e){return d+e})),(l=Va.reduce(zi,(function(e,t){return e.push(i+"-"+t),e}),l)).push(i),l.push(p)}catch(e){return n().error("PFInventory.updateWornArmorAndShield error before getAttrs",e),void r()}getAttrs(l,(function(a){var l=0,f={},m={},_=0,g=0,b="",h="";try{if("set-as-armor"===s||"set-as-shield"===s||e===Qi.Armor||e===Qi.Shield){for(l=0;l<zi.length;l++)"max-dex"!==zi[l]&&"equipped"!==zi[l]&&"type"!==zi[l]&&"enhance"!==zi[l]&&(b=parseInt(a[c+zi[l]],10)||0,parseInt(a[i+"-"+zi[l]],10)!==b&&(f[i+"-"+zi[l]]=b));(b=a[c+"acenhance"])&&(f[i+"-enhance"]=b),(b=a[c+"defense-type"])&&(("shield3"===i&&"Medium"===b||"armor3"===i&&"Tower Shield"===b)&&(b="Heavy"),a[i+"-type"]!==b&&(f[i+"-type"]=b)),b=parseInt(a[c+"max-dex"],10),"-"===a[c+"max-dex"]||isNaN(b)?f[i+"-max-dex"]="-":f[i+"-max-dex"]=b,"1"!==a[i+"-equipped"]&&(f[i+"-equipped"]=1),(b=parseInt(a[d+"set-as-armor"],10))&&(m[d+"set-as-armor"]="0"),(b=parseInt(a[d+"set-as-shield"],10))&&(m[d+"set-as-shield"]="0"),(h=a[d+"name"])?a[i]!==h&&(f[i]=h):f[i]="",_=parseInt(a[d+"equip-type"],10),g=parseInt(a[d+"location"],10),e===Qi.Armor&&_===es.Armor&&g!==Qi.Armor||e===Qi.Shield&&_===es.Armor&&g!==Qi.Shield?(m[d+"old_location"]=g,m[d+"location"]=e,h&&a[p]!==h?m[p]=h:h||(m[p]="")):_!==es.Armor&&_!==es.Shield&&function(e){var t,a;t=is(e),a=t+"-roll",getAttrs([t,a],(function(e){var n="",r={};e[a]&&(r[a]="",(n=mn(e[a]))&&(r["repeating_item_"+n+"_location"]=Qi.Carried,r["repeating_item_"+n+"_old_location"]=Qi.Carried)),e[t]&&(r[t]=""),Va.size(r)&&Ja(r,o.silentParams)}))}(e)}else n().warning("no reason to update armor or shield for "+t+" in location "+Ji[e])}catch(e){n().error("PFInventory.updateWornArmorAndShield INNER error",e)}finally{Va.size(m)>0&&Ja(m,o.silentParams,(function(){g!==e&&us(u,null,0,null)})),Va.size(f)>0?Ja(f,{},r):r()}}))}function ds(e){var t=Va.once((function(){"function"==typeof e&&e()}));getSectionIDs("repeating_item",(function(e){var a,r=0;try{if(!e||!Va.size(e))return void t();r=Va.size(e),a=Va.after(r,t),Va.each(e,(function(e){us(e,a,0,null)}))}catch(e){n().error("PFInventory.updateLocations",e),t()}}))}function fs(e,t,a,r,i){var s,c,l,u=Va.once((function(){"function"==typeof t&&t()})),p=[];"DELETED"!==e?(c=gn(s=e||(r?mn(r.sourceAttribute):"")),l="repeating_item_"+c,p.push(l+"name"),ns.forEach((function(e){p.push(l+"item-"+e)})),p.push(l+"item-wpenhance"),p.push(l+"item-dmg-type"),p.push(l+"default_size"),getAttrs(p,(function(e){var t,r={},c=!1,p=0,d=0,f=!0;a&&o.silentParams;try{0===Va.size(e)&&(f=!1),f?(t=i||generateRowID(),e[l+"name"]&&(i||(r["repeating_weapon_"+t+"_name"]=e[l+"name"]),r["repeating_weapon_"+t+"_source-item-name"]=e[l+"name"]),ns.forEach((function(a){e[l+"item-"+a]&&(r["repeating_weapon_"+t+"_"+a]=e[l+"item-"+a])})),/melee/i.test(e[l+"item-attack-type"])?r["repeating_weapon_"+t+"_damage-ability"]="STR-mod":/ranged/i.test(e[l+"item-attack-type"])&&(r["repeating_weapon_"+t+"_isranged"]=1),(p=parseInt(e[l+"item-wpenhance"],10)||0)&&(r["repeating_weapon_"+t+"_enhance"]=p),e[l+"item-dmg-type"]&&(r["repeating_weapon_"+t+"_type"]=e[l+"item-dmg-type"]),0!==(d=parseInt(e[l+"item-proficiency"],10)||0)&&(d=-4,r["repeating_weapon_"+t+"_proficiency"]=d),e[l+"default_size"]&&(r["repeating_weapon_"+t+"_default_size"]=e[l+"default_size"]),r["repeating_weapon_"+t+"_default_damage-dice-num"]=e[l+"damage-dice-num"]||0,r["repeating_weapon_"+t+"_default_damage-die"]=e[l+"damage-die"]||0,r["repeating_weapon_"+t+"_source-item"]=s,r["repeating_weapon_"+t+"_link_type"]=io.equipment):i&&(r["repeating_weapon_"+i+"_source-item"]="DELETED",c=!0)}catch(e){n().error("PFInventory.createAttackEntryFromRow",e)}finally{c?Ja(r,o.silentParam,u):Va.size(r)>0?(r[l+"create-attack-entry"]=0,Ja(r,o.silentParams,(function(){Co(t,(function(){Tr(),mr(t),u()}))}))):(r[l+"create-attack-entry"]=0,Ja(r,o.silentParams,u))}}))):u()}function ms(e,t){var a=Va.once((function(){"function"==typeof t&&t()})),r="",i="",s="",c="",o=[],l={};try{if(!e)return void a();if(c=mn(e),r=_n(e),0===e.indexOf("repeating_weapon_"))return n().error("PFInventory.updateAssociatedAttack, called on weapon event, no longer supported!"),void a();i=r.replace("item-",""),"name"===r?i="source-item-name":"item-dmg-type"===r?i="type":"wpenhance"===r&&(i="enhance")}catch(e){return n().error("PFInventory.updateAssociatedAttack outer1",e),void a()}getAttrs([e],(function(t){void 0===(s=t[e])&&(s=""),"proficiency"===r&&0!==(s=parseInt(s,10)||0)&&(s=-4),s=String(s),getSectionIDs("repeating_weapon",(function(e){o=Va.reduce(e,(function(e,t){return e=e.concat(["repeating_weapon_"+t+"_source-item","repeating_weapon_"+t+"_"+i])}),[]),getAttrs(o,(function(t){l={};try{Va.each(e,(function(e){var a="",n="";c===t["repeating_weapon_"+e+"_source-item"]&&(a=t[n="repeating_weapon_"+e+"_"+i],"proficiency"===r&&(a=parseInt(a,10)||0),(a=String(a))!==s&&(l[n]=s))}))}catch(e){n().error("PFInventory.updateAssociatedAttack inner1",e)}finally{Va.size(l)>0&&Ja(l)}}))}))}))}function _s(e){var t,a=es.noEquipType;if(!e)return a;if(t=e.toLowerCase().match(/(?:\bwand\b|\bring\b|\brod\b|plate|sword|shield|mail|spear|potion|spellbook|smokestick|incense|scroll|alchemist|antitoxin|antidote|elixir|staff|acid|\boil\b|water|component pouch|arrow|bolt|bullet|sunrod|flask|ration|armor spike|kit|saddle|tool|spike|pole|ladder|lantern|candle|torch|rope|chain|crowbar|\bnet\b|\bram\b|tanglefoot|tinder|flint|vial)/i))switch(t[0]){case"sword":case"spear":case"armor spike":case"net":a=es.Weapon;break;case"mail":case"plate":case"shield":a=es.Armor;break;case"vial":case"flint":case"kit":case"tool":case"spike":case"crowbar":case"ram":case"lantern":case"candle":case"torch":case"rope":case"chain":case"saddle":case"spyglass":case"spellbook":case"tinder":case"component pouch":a=es.Gear;break;case"ring":a=es.OtherMagic;break;case"rod":case"wand":case"staff":a=es.Charged;break;case"tanglefoot":case"incense":case"smokestick":case"sunrod":case"ration":case"water":case"alchemist":case"oil":case"flask":case"acid":case"potion":case"elixir":case"scroll":case"antitoxin":case"antidote":a=es.Consumables;break;case"arrow":case"bolt":case"bullet":case"stone":a=es.Ammo}return a}function gs(e){var t=mn(e.sourceAttribute),a="repeating_item_"+t+"_",r=a+"item-";getAttrs(["default_char_size","equipment_tab",r+"category_compendium",r+"value_compendium",r+"range_compendium",r+"criticaldamage_compendium",r+"criticalrange_compendium",r+"smalldamage_compendium",r+"meddamage_compendium",r+"damagetype_compendium",r+"speed20_compendium",r+"speed30_compendium",r+"weight_compendium",r+"spell-fail_compendium",r+"acbonus_compendium",r+"acp_compendium",r+"dmg-type",a+"description",r+"max-dex",a+"name"],(function(e){var i,s,c={},l=0,u=0,p="",d=0,f=0,m=es.noEquipType,_=0,g=0;try{if("Items"!==e[r+"category_compendium"])return void n().warn("compendium item is "+e["repeating_item_item-category_compendium"]+", INVALID");c[a+"row_id"]=t,s=e[a+"name"],Hn(r,"range",e,c),n().debug("Before calling get value",c),function(e,t,a,r,i,s){var c=0,o=r[e+t+"_compendium"];i=i||{},n().debug("PFUtils.getCompendiumFunctionSet getting "+e+t+"_compendium, val: "+o),o&&(c=a(o),n().debug("on return value is:"+c),c&&(s=s||t,n().debug("setting "+e+t+" with value "+c),i[e+s]=c))}(a,"item-value",Mn,e,c,"value"),n().debug("After calling get value",c),Hn(r,"spell-fail",e,c),Hn(r,"acbonus",e,c),Hn(r,"acp",e,c),e[r+"acbonus_compendium"]&&(f=1),g=parseInt(e[r+"speed20_compendium"],10)||0,_=parseInt(e[r+"speed30_compendium"],10)||0,e[r+"max-dex"]&&(i=(i=e[r+"max-dex"]).replace(/\u2013|\u2014|-|\\u2013|\\u2014/,"-"))!==e[r+"max-dex"]&&(c[r+"max-dex"]=i),e[r+"damagetype_compendium"]&&(i=(i=e[r+"damagetype_compendium"]).replace(/\u2013|\u2014|-|\\u2013|\\u2014/,""))&&(i=e[r+"dmg-type"]?e[r+"dmg-type"]+" "+e[r+"damagetype_compendium"]:e[r+"damagetype_compendium"],c[r+"dmg-type"]=i),e[r+"criticaldamage_compendium"]&&(d=1,(i=Nn(e[r+"criticaldamage_compendium"]))&&2!==i.critmult&&(c[r+"crit-multiplier"]=i.critmult)),e[r+"criticalrange_compendium"]&&(d=1,(i=Nn(e[r+"criticalrange_compendium"]))&&20!==i.crit&&(c[r+"crit-target"]=i.crit)),l=parseInt(e.default_char_size,10)||0,p="meddamage_compendium",u=0,l>=1&&(u=1,p="smalldamage_compendium"),0!==l&&(c[a+"default_size"]=u),Hn(r,"weight",e,c),l>=1&&(u=parseInt(c[r+"weight"],10)||0)&&(u=Math.floor(u/2*100)/100,c[r+"weight"]=u),e[r+p]&&(d=1,(i=Rn(e[r+p]))&&(i.dice&&i.die&&(c[r+"damage-dice-num"]=i.dice,c[r+"damage-die"]=i.die),i.plus&&(c[r+"damage"]=i.plus))),d?(m=es.Weapon,e[r+"range_compendium"]&&parseInt(e[r+"range_compendium"],10)>0?c[r+"attack-type"]="attk-ranged":c[r+"attack-type"]="attk-melee"):f?(m=es.Armor,s&&(p=/tower/i.test(s)?"Tower Shield":30===_&&20===g?"Light":/heavy|stone|full|half.plate|splint|banded|iron|tatami|kusari/i.test(s)?"Heavy":/medium|mountain|chainmail|breastplate|scale|kikko|steel|horn|mirror|hide|maru|armored coat/i.test(s)?"Medium":"Light",c[r+"defense-type"]=p)):m=_s(s),m<0?m=es.Other:m===es.Weapon?c[a+"weapon-attributes-show"]=1:m===es.Armor&&(c[a+"armor-attributes-show"]=1),m&&(c.equipment_tab=m,c[a+"equip-type"]=m,c[a+"equiptype-tab"]=m),c[a+"qty"]=1,c[a+"qty_max"]=1,c[a+"location"]=Qi.Carried,c[a+"old_location"]=Qi.Carried,c[a+"loctype-tab"]=Qi.Carried,c[r+"category_compendium"]="",c[r+"value_compendium"]="",c[r+"range_compendium"]="",c[r+"criticaldamage_compendium"]="",c[r+"criticalranage_compendium"]="",c[r+"smalldamage_compendium"]="",c[r+"meddamage_compendium"]="",c[r+"damagetype_compendium"]="",c[r+"speed20_compendium"]="",c[r+"speed30_compendium"]="",c[r+"weight_compendium"]="",c[r+"spell-fail_compendium"]="",c[r+"acbonus_compendium"]="",c[r+"acp_compendium"]=""}catch(e){n().error("importFromCompendium",e)}finally{Va.size(c)>0&&Ja(c,o.silentParams,ss)}}))}function bs(e){var t=Va.once((function(){"function"==typeof e&&e()}));getSectionIDs("repeating_item",(function(e){var a;e&&Va.size(e)?(a=Va.reduce(e,(function(e,t){return e.push("repeating_item_"+t+"_has_uses"),e.push("repeating_item_"+t+"_qty_max"),e}),[]),getAttrs(a,(function(a){var r={};try{r=Va.reduce(e,(function(e,t){var r="repeating_item_"+t+"_",i=0;try{i=parseInt(a[r+"qty_max"],10)||0,e[r+"has_uses"]=i>1?"true":""}catch(e){n().error("PFInventory.updateUses error repeating_item  id "+t,e)}finally{return e}}),{})}catch(e){n().error("PFInventory.updateUses error setting defaults ",e)}finally{Va.size(r)>0?Ja(r,o.silentParams,t):t()}}))):t()}))}function hs(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));!function(e){var t=function(){"function"==typeof e&&e()};getAttrs(["migrated_repeating_item_attributes"],(function(e){var a=["weight","hp","hp_max"],r=["qty","qty_max"];parseInt(e.migrated_repeating_item_attributes,10)?t():getSectionIDs("repeating_item",(function(e){var i;e&&Va.size(e)>0?(i=Va.reduce(e,(function(e,t){var n="repeating_item_"+gn(t),i=[];return Va.each(a,(function(e){i.push(n+e)})),Va.each(r,(function(e){i.push(n+e)})),e.concat(i)}),[]),getAttrs(i,(function(r){var i={};try{Va.each(e,(function(e){var t="repeating_item_"+gn(e);a.forEach((function(e){var a=parseInt(r[t+e],10)||0;r[t+e]&&0!==a&&(i[t+"item-"+e]=a,i[t+e]="")})),isNaN(parseInt(r[t+"qty"],10))&&(i[t+"qty"]=1),isNaN(parseInt(r[t+"qty_max"],10))&&(i[t+"qty_max"]=0)})),i.migrated_repeating_item_attributes="1"}catch(e){n().error("migrateRepeatingItemAttributes",e)}finally{Va.size(i)>0?Ja(i,{},t):t()}}))):Ja({migrated_repeating_item_attributes:1},o.silentParams,t)}))}))}(n().callback((function(){!function(e){var t=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["migrated_itemlist_defaults"],(function(e){try{if(1===parseInt(e.migrated_itemlist_defaults,10))return void t();getSectionIDs("repeating_item",(function(e){var a=[];try{if(!e||!Va.size(e))return void t();a=Va.map(e,(function(e){return["repeating_item_"+e+"_name","repeating_item_"+e+"_location","repeating_item_"+e+"_qty_max","repeating_item_"+e+"_equip-type"]})),a=Va.flatten(a)}catch(e){return n().error("PFInventory.setNewDefaults miderror",e),void t()}getAttrs(a,(function(a){var r={},i=0;try{r=Va.reduce(e,(function(e,t){var r="repeating_item_"+t+"_",s=0,c=r+"name",o=0,l=0;try{o=parseInt(a[r+"location"],10),isNaN(o)&&(o=Qi.Carried,e[r+"location"]=o),e[r+"oldlocation"]=o,e[r+"loctype-tab"]=o===Qi.NotCarried?Qi.NotCarried:o===Qi.Carried?Qi.Carried:o>Qi.NotCarried?Qi.equipped:-1,s=parseInt(a[r+"qty_max"],10),isNaN(s)&&(s=0,e[r+"_qty_max"]=s),e[r+"has_uses"]=s>1?"true":"",(i=parseInt(a["repeating_item_"+t+"_equip-type"],10))?e[r+"equiptype-tab"]=i:(a[c]&&(l=_s(a[c])),l?(e[r+"equip-type"]=l,e[r+"equiptype-tab"]=l):(e[r+"equip-type"]=es.noEquipType,e[r+"equiptype-tab"]=es.noEquipType)),e[r+"showinmenu"]=0}catch(e){n().error("PFInventory.setNewDefaults error repeating_item  id "+t,e)}finally{return e}}),{})}catch(e){n().error("PFInventory.setNewDefaults error setting defaults ",e)}finally{Va.size(r)>0?(r.migrated_itemlist_defaults=1,Ja(r,o.silentParams,t)):t()}}))}))}catch(e){n().error("PFInventory.setNewDefaults outererr",e),t()}}))}(n().callback((function(){ls(a)})))})))}var ys=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFInventory.recalculate"),"function"==typeof e&&e()})),i=Va.after(2,(function(){n().debug("PFInventory.recalculate at setTotals"),ds(bs),rs(),function(e){var t=Va.once((function(){"function"==typeof e&&e()}));getSectionIDs("repeating_item",(function(e){e&&Va.size(e)>0?getAttrs(Zi,(function(a){var r=[],i=[];try{i=Va.map(e,(function(e){return e.toLowerCase()})),r=Va.chain(a).omit((function(e,t){return!e})).mapObject((function(e){return mn(e).toLowerCase()})).omit((function(e,t){return Va.contains(i,e)})).value(),Va.size(r)>0?Ja(Va.reduce(r,(function(e,t,a){return e[a.slice(-5)]="",e[a]="",e}),{}),o.params,t):t()}catch(e){n().error("PFInventory.deleteOrphanWornRows",e),t()}})):t()}))}(),os(r)}));try{n().debug("at PFInventory.recalculate"),hs((function(){cs(i,t),ss(i)}))}catch(e){n().error("PFInventory.recalculate",e),r()}}));on("change:repeating_item:item-category_compendium",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),gs(e))}))),on("change:repeating_item:location",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["repeating_item_location","repeating_item_old_location"],(function(t){var a=parseInt(t.repeating_item_location,10),n=parseInt(t.repeating_item_old_location,10);a===Qi.Armor||a===Qi.Shield?ps(a,e.sourceAttribute,(function(){us(null,null,0,e)})):us(null,null,0,e),(a!==Qi.NotCarried||n!==Qi.NotCarried&&n!==a)&&ss(null,0,{weight:1})}))}))),on("change:repeating_item:qty_max",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),ss(),getAttrs(["repeating_item_qty_max"],(function(e){parseInt(e.repeating_item_qty_max,10)>1?Ja({repeating_item_has_uses:"true"},o.silentParams):Ja({repeating_item_has_uses:""},o.silentParams)})))}))),on("change:repeating_item:qty",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["repeating_item_qty_max"],(function(e){var t=parseInt(e.repeating_item_qty_max,10)||0;0!==t&&1!==t||ss()})))}))),on("change:repeating_item:value",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),ss(null,0,{value:1}))}))),on("change:repeating_item:item-weight",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["repeating_item_location"],(function(e){parseInt(e.repeating_item_location,10)!==Qi.NotCarried&&ss(null,0,{weight:1})})))}))),on("remove:repeating_item",n().callback((function(e){var t,a,r;n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType);var i=Object.keys(e.removedInfo).find((function(e){return e.endsWith("_location")&&e.length>13})),s=Object.keys(e.removedInfo).find((function(e){return e.endsWith("_equip-type")})),c=Object.keys(e.removedInfo).find((function(e){return e.endsWith("_name")}));t=i?+e.removedInfo[i]:null,a=s?+e.removedInfo[s]:null,r=c?e.removedInfo[c]:"","player"!==e.sourceType&&"api"!==e.sourceType||(console.log("Change detected: Removed Row location:".concat(t," type:").concat(a," name:").concat(r)),ss(),function(e,t,a,r,i){var s=e.toLowerCase();getAttrs(["armor3","shield3"].concat(Vi(Zi)),(function(c){var l="",u="",p="",d=c.armor3||"",f=c.shield3||"",m={};try{(l=Va.findKey(c,(function(e){return!!e&&e.toLowerCase().indexOf(s)>=0})))?(u=l.slice(0,-5),m[l]="",m[u]="",2===t?p="armor3":14===t&&(p="shield3")):2===a&&r===d?p="armor3":2===a&&r===f&&(p="shield3"),p&&(m[p]="",m[p+"-equipped"]=1,m[p+"-acbonus"]=0,m[p+"-enhance"]=0,m[p+"-max-dex"]="-",m[p+"-acp"]=0,m[p+"-spell-fail"]=0,m[p+"-type"]="",m[p+"-proficiency"]=1),Va.size(m)>0?Ja(m,o.silent,i):"function"==typeof i&&i()}catch(t){n().error("PFInventory.event delete item for attribute: "+e,t),"function"==typeof i&&i()}}))}(e.sourceAttribute,t,a,r)),xo(null,io.equipment,mn(e.sourceAttribute))}))),on("change:CP change:SP change:GP change:PP",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),cs()}))),on("change:carried-currency change:carried-currency-toggle change:item_total_weight change:carried-misc",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),os()}))),on("change:use_metrics",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),os(),cs(),ss())}))),on("change:repeating_item:item-defense-type change:repeating_item:item-acbonus change:repeating_item:item-max-dex change:repeating_item:item-acp change:repeating_item:item-spell-fail change:repeating_item:item-proficiency change:repeating_item:acenhance",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),getAttrs(["repeating_item_location"],(function(t){var a=parseInt(t.repeating_item_location,10)||0;a!==Qi.Armor&&a!==Qi.Shield||ps(a,e.sourceAttribute)}))}))),Va.each(ns,(function(e){on("change:repeating_item:item-"+e,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||ms(e.sourceAttribute)})))})),on("change:repeating_item:name change:repeating_item:item-dmg-type change:repeating_item:item-proficiency change:repeating_item:default_size change:repeating_item:wpenhance",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||ms(e.sourceAttribute)}))),on("change:repeating_item:create-attack-entry",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||fs(null,null,!1,e)}))),on("change:repeating_item:set-as-armor",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||ps(Qi.Armor,e.sourceAttribute,(function(){us(null,null,0,e)}))}))),on("change:repeating_item:set-as-shield",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||ps(Qi.Shield,e.sourceAttribute,(function(){us(null,null,0,e)}))}))),on("change:repeating_item:showinmenu change:repeating_item:equip-type change:repeating_item:name",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||rs()}))),on("change:repeating_item:name",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||us(null,null,0,e)}))),on("change:repeating_item:equip-type",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["repeating_item_equip-type","repeating_item_equiptype-tab","equipment_tab"],(function(e){var t=parseInt(e["repeating_item_equip-type"],10)||0,a=parseInt(e["repeating_item_equiptype-tab"],10),n=parseInt(e.equipment_tab,10)||0,r={};(t!==a||isNaN(a))&&(r["repeating_item_equiptype-tab"]=t),t>0&&t!==n&&n<9&&(r.equipment_tab=t),Va.size(r)&&Ja(r,o.silentParams)}))}))),on("change:showinmenu_all_items",(function(){getSectionIDs("repeating_item",(function(e){var t=e.map((function(e){return"repeating_item_".concat(e,"_showinmenu")}));getAttrs(["showinmenu_all_items"],(function(e){var a=+e.showinmenu_all_items||0,n=t.reduce((function(e,t){return e[t]=a,e}),{});setAttrs(n),ys()}))}))}));var vs,ks=["toggle_spell_school_notes","toggle_spell_casting_time_notes","toggle_spell_duration_notes","toggle_spell_saving_throw_notes","toggle_spell_sr_notes","toggle_spell_range_notes","toggle_spell_targets_notes","toggle_spell_description_notes","toggle_spell_concentration_notes","toggle_spell_concentration_check","toggle_spell_casterlevel_notes","toggle_spell_casterlevel_check","toggle_spell_level_notes","toggle_spell_components_notes","toggle_spell_spellnotes_notes","toggle_spell_spell_fail_check","toggle_spell_damage_notes","toggle_spell_spellPen_check","toggle_spell_dc_notes"],ws={school:" {
               {
                school=@ {
                  school
                }
                
              }
              
            }
            ",casting_time:" {
               {
                casting_time=@ {
                  cast-time
                }
                
              }
              
            }
            ",components:" {
               {
                components=@ {
                  components
                }
                
              }
              
            }
            ",duration:" {
               {
                duration=@ {
                  duration
                }
                
              }
              
            }
            ",saving_throw:" {
               {
                saving_throw=@ {
                  save
                }
                
              }
              
            }
            ",sr:" {
               {
                sr=@ {
                  sr
                }
                
              }
              
            }
            ",casterlevel:" {
               {
                casterlevel=[[ @ {
                  casterlevel
                }
                 ]]
              }
              
            }
            ",range:" {
               {
                range=@ {
                  range_numeric
                }
                
              }
              
            }
            ",targets:" {
               {
                targets=@ {
                  targets
                }
                
              }
              
            }
            ",Concentration:" {
               {
                Concentration=[[ @ {
                  Concentration-mod
                }
                 ]]
              }
              
            }
            ",description:" {
               {
                description=@ {
                  description
                }
                
              }
              
            }
            ",dc:" {
               {
                dc=[[ @ {
                  savedc
                }
                 ]]
              }
              
            }
            ",spellPen:" {
               {
                spellPen=[[ @ {
                  SP-mod
                }
                 ]]
              }
              
            }
            ",range_pick:" {
               {
                @ {
                  range_pick
                }
                =Range_pick
              }
              
            }
            ",rangetext:" {
               {
                rangetext=@ {
                  range
                }
                
              }
              
            }
            ",level:" {
               {
                level=@ {
                  spell_level
                }
                
              }
              
            }
            ",spellclass:" {
               {
                spellclass=@ {
                  spellclass
                }
                
              }
              
            }
            ",cast_def:" {
               {
                cast_def=[[ REPLACE ]]
              }
              
            }
            ",cast_defDC:" {
               {
                cast_defDC=[[ REPLACE ]]
              }
              
            }
            ",concentrationNote:" {
               {
                concentrationNote=REPLACE
              }
              
            }
            ",spellPenNote:" {
               {
                spellPenNote=REPLACE
              }
              
            }
            ",casterlevel_chk:" {
               {
                casterlevel_chk=[[ 1d20 + @ {
                  casterlevel
                }
                 ]]
              }
              
            }
            ",Concentration_chk:" {
               {
                Concentration_chk=[[ 1d20 + @ {
                  Concentration-mod
                }
                 ]]
              }
              
            }
            ",spellnotes:" {
               {
                spells_notes=REPLACE
              }
              
            }
            ",spell_fail_check:" {
               {
                spell_fail_check=[[ 1d100cf<[[ @ {
                  spell-fail
                }
                 ]]cs>[[ @ {
                  spell-fail
                }
                +1 ]] ]]
              }
              
            }
            ",spell_fail:" {
               {
                spell_fail=@ {
                  spell-fail
                }
                
              }
              
            }
            ",spelldamage:" {
               {
                spelldamage=@ {
                  damage-macro-text
                }
                
              }
              
            }
            ",spelldamagetype:" {
               {
                spelldamagetype=@ {
                  damage-type
                }
                
              }
              
            }
            ",spellPen_chk:" {
               {
                spellPen_chk=[[ 1d20 + @ {
                  casterlevel
                }
                 + @ {
                  SP-mod
                }
                 ]]
              }
              
            }
            "},As=(vs=ws,Va.mapObject(vs,(function(e,t){return Cn(t)?new RegExp("((?=\\ {
              \\ {
                )|(?=^))\\s*\\ {
                  \\ {
                    \\.*?\\="+t+"\\
                  }
                  \\
                }
                \\s*((?=\\ {
                  \\ {
                    )|(?=$))"):new RegExp("\\s*((?=\\ {
                      \\ {
                        )|(?=^))\\ {
                          \\ {
                            "+t+"\\=.*?\\
                          }
                          \\
                        }
                        \\s*((?=\\ {
                          \\ {
                            )|(?=$))")}))),Cs=ks.concat(["Concentration-0-def","Concentration-1-def","Concentration-2-def","spell-fail"]),Is=["school","cast-time","duration","save","sr","range_numeric","targets","description","Concentration-mod","savedc","SP-mod","range_pick","range","spell_level","spellclass","casterlevel","components","spellclass_number","damage-macro-text","damage-type"].concat(["spellclass_number","SP_misc","CL_misc","Concentration_misc","slot","spell-attack-type"]),xs={school:"toggle_spell_school_notes","cast-time":"toggle_spell_casting_time_notes",components:"toggle_spell_components_notes",duration:"toggle_spell_duration_notes",save:"toggle_spell_saving_throw_notes",dc:"toggle_spell_dc_notes",sr:"toggle_spell_sr_notes",range:"toggle_spell_range_notes",targets:"toggle_spell_targets_notes",description:"toggle_spell_description_notes",spellnotes:"toggle_spells_notes",spell_fail_check:"toggle_spell_spell_fail_check","damage-macro-text":"toggle_spell_damage_notes","damage-type":"toggle_spell_damage_notes"},Ps=["school","cast-time","components","duration","save","sr","range","targets","damage-macro-text","damage-type","sp-mod"];function Ss(e,t,a,r){var i="repeating_spells_"+gn(e),s=parseInt(r[i+"Concentration_misc"],10)||0,c=parseInt(r[i+"CL_misc"],10)||0,o=parseInt(r[i+"spellclass_number"],10),l=parseInt(r[i+"spell_level"],10),u=parseInt(r[i+"slot"],10),p=(parseInt(r[i+"casterlevel"],10),parseInt(r[i+"Concentration-mod"],10),15+2*(isNaN(u)||u===l?l:u)),d=parseInt(a["Concentration-"+o+"-def"],10)||0,f=" {
                               {
                                condition_note=@ {
                                  condition_spell_notes
                                }
                                
                              }
                              
                            }
                            ";return isNaN(o)||isNaN(l)?(n().warn("cannot set options for spell! id:"+e+"  class or level are not numbers")," {
                               {
                                condition_note=@ {
                                  condition_spell_notes
                                }
                                
                              }
                              
                            }
                            "):(a.showschool&&(f+=ws.school),a.showlevel&&(f+=ws.spellclass,f+=ws.level),a.showcasting_time&&(!r[i+"cast-time"]||/1 (S\.A\.|standard action)/i.test(r[i+"cast-time"])?f+=" {
                               {
                                casting_time=
                              }
                              
                            }
                            ":f+=ws.casting_time),a.showcomponents&&(f+=ws.components),a.showsaving_throw&&a.showdc?(In("saving_throw",r[i+"save"]||"")?f+=" {
                               {
                                saving_throw=
                              }
                              
                            }
                            ":f+=ws.saving_throw,f+=ws.dc):(In("saving_throw",r[i+"save"]||"")?f+=" {
                               {
                                saving_throw=
                              }
                              
                            }
                            ":f+=ws.saving_throw,f+=" {
                               {
                                dc=
                              }
                              
                            }
                            "),a.showrange&&(f+=ws.range_pick,f+=ws.range,f+=ws.rangetext),a.showtargets&&(f+=ws.targets),a.showduration&&(f+=ws.duration),a.showsr&&(In("sr",r[i+"sr"]||"")?f+=" {
                               {
                                sr=
                              }
                              
                            }
                            ":f+=ws.sr,f+=parseInt(r[i+"SP-mod"],10)||0?ws.spellPen:" {
                               {
                                spellPen=
                              }
                              
                            }
                            "),a.showcasterlevel&&c?f+=ws.casterlevel:f+=" {
                               {
                                casterlevel=
                              }
                              
                            }
                            ",a.showcasterlevel&&(f+=ws.casterlevel),a.showcasterlevel_check&&(f+=ws.casterlevel_chk),a.showspellpen_check&&(f+=ws.spellPen_chk),(a.showcasterlevel||a.showcasterlevel_check)&&0===(parseInt(r[i+"SP-mod"],10)||0)&&(f+=ws.spellPen),a.showconcentration&&(s||c)?f+=ws.Concentration:f+=" {
                               {
                                Concentration=
                              }
                              
                            }
                            ",a.showconcentration_check&&a.showcasterlevel&&(f+=ws.Concentration),a.showconcentration_check&&(f+=ws.Concentration_chk),(a.showconcentration||a.showconcentration_check)&&a.showdc?(f+=d>0?ws.cast_def.replace("REPLACE",d)||"":" {
                               {
                                cast_def=
                              }
                              
                            }
                            ",f+=ws.cast_defDC.replace("REPLACE",p)||""):(f+=d>0?ws.cast_def.replace("REPLACE",d)||"":" {
                               {
                                cast_def=
                              }
                              
                            }
                            ",f+=" {
                               {
                                cast_defDC=
                              }
                              
                            }
                            "),a.showdescription&&(f+=ws.description),a.showspellnotes&&(f+=ws.spellnotes.replace("REPLACE","@ {
                              spell-class-"+o+"-spells-notes
                            }
                            ")||""),a.showspell_fail_check&&(f+=ws.spell_fail_check,f+=ws.spell_fail),a.showdamage?(r[i+"damage-macro-text"]?f+=ws.spelldamage:f+=" {
                               {
                                spelldamage=
                              }
                              
                            }
                            ",r["damage-type"]?f+=ws.spelldamagetype:f+=" {
                               {
                                spelldamagetype=@ {
                                  damage-type
                                }
                                
                              }
                              
                            }
                            "):f+=" {
                               {
                                spelldamage=
                              }
                              
                            }
                             {
                               {
                                spelldamagetype=@ {
                                  damage-type
                                }
                                
                              }
                              
                            }
                            ",f)}function Ts(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(Cs,(function(e){var t;try{n().debug("PFSpellOptions.resetOptions:",e),t=Va.chain(ks).reduce((function(t,a){return t["show"+a.toLowerCase().slice(13).replace("_notes","")]=parseInt(e[a],10)||0,t}),{}).extend({"Concentration-0-def":parseInt(e["Concentration-0-def"],10)||0,"Concentration-1-def":parseInt(e["Concentration-1-def"],10)||0,"Concentration-2-def":parseInt(e["Concentration-2-def"],10)||0}).value(),n().debug("PFSPellOptions.resetOptions: ",t),getSectionIDs("repeating_spells",(function(e){var r;e&&0!==Va.size(e)?(r=bn(Va.map(e,(function(e){return"repeating_spells_"+e+"_"})),Is),getAttrs(r,(function(r){var i={};Va.each(e,(function(e){var a="";try{a=Ss(e,0,t,r)||" {
                               {
                                condition_note=@ {
                                  condition_spell_notes
                                }
                                
                              }
                              
                            }
                            ",i["repeating_spells_"+e+"_spell_options"]=a}catch(t){n().error("PFSpellOptions.resetOptions error on id "+e+", innererr",t)}})),Va.size(i)>0?Ja(i,o.silentParams,a):a()}))):a()}))}catch(e){n().error("PFSpellOptions.resetOptions outererr:",e),a()}}))}n().callback((function(e){Ts(e)}));function Es(e){return Es="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},Es(e)}function Ds(e){return function(e){if(Array.isArray(e))return Ms(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return Ms(e,t);var a={}.toString.call(e).slice(8,-1);return"Object"===a&&e.constructor&&(a=e.constructor.name),"Map"===a||"Set"===a?Array.from(e):"Arguments"===a||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a)?Ms(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Ms(e,t){(null==t||t>e.length)&&(t=e.length);for(var a=0,n=Array(t);a<t;a++)n[a]=e[a];return n}function Fs(e,t,a){return(t=function(e){var t=function(e,t){if("object"!=Es(e)||!e)return e;var a=e[Symbol.toPrimitive];if(void 0!==a){var n=a.call(e,t||"default");if("object"!=Es(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(e)}(e,"string");return"symbol"==Es(t)?t:t+""}(t))in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}Va.each(Ps,(function(e){on("change:repeating_spells:"+e,n().callback((function(t){var a,r,i;"player"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),r="repeating_spells_"+(a=e),i=xs[a],getAttrs([r,"repeating_spells_spell_options","repeating_spells_spell_lvlstr",i,"repeating_spells_sr","repeating_spells_SP-mod","repeating_spells_savedc"],(function(e){var t=e.repeating_spells_spell_options,s="",c={};if(!e.repeating_spells_spell_lvlstr&&t)try{if(s=e[r]||"",1===parseInt(e[i],10)){switch(a){case"school":t=t.replace(As.school,ws.school);break;case"cast-time":t=!s||/1\s+(S\.A\.|standard action)/i.test(s)?xn(t,"casting_time",As):t.replace(As.casting_time,ws.casting_time);break;case"components":t=t.replace(As.components,ws.components);break;case"duration":t=t.replace(As.duration,ws.duration);break;case"range":t=t.replace(As.range,ws.range);break;case"targets":t=t.replace(As.targets,ws.targets);break;case"save":t=In("saving_throw",s)?xn(t,"saving_throw",As):t.replace(As.saving_throw,ws.saving_throw);break;case"sr":t=In("sr",s)?xn(t,"sr",As):t.replace(As.sr,ws.sr);break;case"damage-macro-text":t=s?t.replace(As.spelldamage,ws.spelldamage):xn(t,"spelldamage",As);break;case"damage-type":t=s?t.replace(As.spelldamagetype,ws.spelldamagetype):xn(t,"spelldamagetype",As);break;case"sp-mod":n().debug("found damage type"+s),t=s?t.replace(As.spellPen,ws.spellPen):xn(t,"spellPen",As)}c.repeating_spells_spell_options=t,Ja(c,{silent:!0})}}catch(e){n().error("PFSpellOptions.updateSpellOption",e)}})))})))})),Va.each(ks,(function(e){on("change:"+e,n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Ts(null))})))}));var Ns=["0","1","2","3","4","5","6","7","8","9"],Rs={arcanist:"wizard",investigator:"alchemist",warpriest:"cleric",skald:"bard",bloodrager:"sorcerer"};function zs(e,t,a){var r=Va.once((function(){"function"==typeof a&&a()})),i=["spell_level","spellclass_number","name","school","slot","metamagic","used","isDomain","isMythic"],s=["& {
                              template:pf_block
                            }
                             @ {
                              toggle_spell_accessible
                            }
                             @ {
                              toggle_rounded_flag
                            }
                             {
                               {
                                font=@ {
                                  apply_specfont_chat
                                }
                                @ {
                                  use_specfont
                                }
                                
                              }
                              
                            }
                              {
                               {
                                scroll_desc=@ {
                                  scroll-desc
                                }
                                
                              }
                              
                            }
                              {
                               {
                                color=@ {
                                  rolltemplate_color
                                }
                                
                              }
                              
                            }
                              {
                               {
                                header_image=@ {
                                  header_image-pf_block
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_name=@ {
                                  character_name
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_id=@ {
                                  character_id
                                }
                                
                              }
                              
                            }
                              {
                               {
                                subtitle
                              }
                              
                            }
                              {
                               {
                                name=@ {
                                  spellclass-0-name
                                }
                                 ^ {
                                  spells
                                }
                                
                              }
                              
                            }
                              {
                               {
                                concentration=@ {
                                  Concentration-0
                                }
                                
                              }
                              
                            }
                              {
                               {
                                casterlevel=@ {
                                  spellclass-0-level-total
                                }
                                
                              }
                              
                            }
                              {
                               {
                                row01=**^ {
                                  checks
                                }
                                **
                              }
                              
                            }
                              {
                               {
                                row02=[^ {
                                  caster-level-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Class-0-CL-Check) [^ {
                                  concentration-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Concentration-Check-0) [^ {
                                  spell-failure
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Fail-Check)
                              }
                              
                            }
                            ","& {
                              template:pf_block
                            }
                             @ {
                              toggle_spell_accessible
                            }
                             @ {
                              toggle_rounded_flag
                            }
                             {
                               {
                                font=@ {
                                  apply_specfont_chat
                                }
                                @ {
                                  use_specfont
                                }
                                
                              }
                              
                            }
                              {
                               {
                                scroll_desc=@ {
                                  scroll-desc
                                }
                                
                              }
                              
                            }
                              {
                               {
                                color=@ {
                                  rolltemplate_color
                                }
                                
                              }
                              
                            }
                              {
                               {
                                header_image=@ {
                                  header_image-pf_block
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_name=@ {
                                  character_name
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_id=@ {
                                  character_id
                                }
                                
                              }
                              
                            }
                              {
                               {
                                subtitle
                              }
                              
                            }
                              {
                               {
                                name=@ {
                                  spellclass-1-name
                                }
                                 ^ {
                                  spells
                                }
                                
                              }
                              
                            }
                              {
                               {
                                concentration=@ {
                                  Concentration-1
                                }
                                
                              }
                              
                            }
                              {
                               {
                                casterlevel=@ {
                                  spellclass-1-level-total
                                }
                                
                              }
                              
                            }
                              {
                               {
                                row01=**^ {
                                  checks
                                }
                                **
                              }
                              
                            }
                              {
                               {
                                row02=[^ {
                                  caster-level-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Class-1-CL-Check) [^ {
                                  concentration-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Concentration-Check-1) [^ {
                                  spell-failure
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Fail-Check)
                              }
                              
                            }
                            ","& {
                              template:pf_block
                            }
                             @ {
                              toggle_spell_accessible
                            }
                             @ {
                              toggle_rounded_flag
                            }
                             {
                               {
                                font=@ {
                                  apply_specfont_chat
                                }
                                @ {
                                  use_specfont
                                }
                                
                              }
                              
                            }
                              {
                               {
                                scroll_desc=@ {
                                  scroll-desc
                                }
                                
                              }
                              
                            }
                              {
                               {
                                color=@ {
                                  rolltemplate_color
                                }
                                
                              }
                              
                            }
                              {
                               {
                                header_image=@ {
                                  header_image-pf_block
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_name=@ {
                                  character_name
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_id=@ {
                                  character_id
                                }
                                
                              }
                              
                            }
                              {
                               {
                                subtitle
                              }
                              
                            }
                              {
                               {
                                name=@ {
                                  spellclass-2-name
                                }
                                 ^ {
                                  spells
                                }
                                
                              }
                              
                            }
                              {
                               {
                                concentration=@ {
                                  Concentration-2
                                }
                                
                              }
                              
                            }
                              {
                               {
                                casterlevel=@ {
                                  spellclass-2-level-total
                                }
                                
                              }
                              
                            }
                              {
                               {
                                row01=**^ {
                                  checks
                                }
                                **
                              }
                              
                            }
                              {
                               {
                                row02=[^ {
                                  caster-level-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Class-2-CL-Check) [^ {
                                  concentration-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Concentration-Check-2) [^ {
                                  spell-failure
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Fail-Check)
                              }
                              
                            }
                            "],c=["& {
                              template:pf_block
                            }
                             @ {
                              toggle_spell_accessible
                            }
                             @ {
                              toggle_rounded_flag
                            }
                             {
                               {
                                font=@ {
                                  apply_specfont_chat
                                }
                                @ {
                                  use_specfont
                                }
                                
                              }
                              
                            }
                              {
                               {
                                scroll_desc=@ {
                                  scroll-desc
                                }
                                
                              }
                              
                            }
                              {
                               {
                                color=@ {
                                  rolltemplate_color
                                }
                                
                              }
                              
                            }
                              {
                               {
                                header_image=@ {
                                  header_image-pf_block
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_name=@ {
                                  character_name
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_id=@ {
                                  character_id
                                }
                                
                              }
                              
                            }
                              {
                               {
                                subtitle
                              }
                              
                            }
                              {
                               {
                                name=^ {
                                  npc
                                }
                                 @ {
                                  spellclass-0-name
                                }
                                 ^ {
                                  spells
                                }
                                
                              }
                              
                            }
                              {
                               {
                                concentration=@ {
                                  Concentration-0
                                }
                                
                              }
                              
                            }
                              {
                               {
                                casterlevel=@ {
                                  spellclass-0-level-total
                                }
                                
                              }
                              
                            }
                              {
                               {
                                row01=**^ {
                                  checks
                                }
                                **
                              }
                              
                            }
                              {
                               {
                                row02=[^ {
                                  caster-level-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Class-0-CL-Check) [^ {
                                  concentration-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Concentration-Check-0) [^ {
                                  spell-failure
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Fail-Check)
                              }
                              
                            }
                            ","& {
                              template:pf_block
                            }
                             @ {
                              toggle_spell_accessible
                            }
                             @ {
                              toggle_rounded_flag
                            }
                             {
                               {
                                font=@ {
                                  apply_specfont_chat
                                }
                                @ {
                                  use_specfont
                                }
                                
                              }
                              
                            }
                              {
                               {
                                scroll_desc=@ {
                                  scroll-desc
                                }
                                
                              }
                              
                            }
                              {
                               {
                                color=@ {
                                  rolltemplate_color
                                }
                                
                              }
                              
                            }
                              {
                               {
                                header_image=@ {
                                  header_image-pf_block
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_name=@ {
                                  character_name
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_id=@ {
                                  character_id
                                }
                                
                              }
                              
                            }
                              {
                               {
                                subtitle
                              }
                              
                            }
                              {
                               {
                                name=^ {
                                  npc
                                }
                                 @ {
                                  spellclass-1-name
                                }
                                 ^ {
                                  spells
                                }
                                
                              }
                              
                            }
                              {
                               {
                                concentration=@ {
                                  Concentration-1
                                }
                                
                              }
                              
                            }
                              {
                               {
                                casterlevel=@ {
                                  spellclass-1-level-total
                                }
                                
                              }
                              
                            }
                              {
                               {
                                row01=**^ {
                                  checks
                                }
                                **
                              }
                              
                            }
                              {
                               {
                                row02=[^ {
                                  caster-level-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Class-1-CL-Check) [^ {
                                  concentration-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Concentration-Check-1) [^ {
                                  spell-failure
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Fail-Check)
                              }
                              
                            }
                            ","& {
                              template:pf_block
                            }
                             @ {
                              toggle_spell_accessible
                            }
                             @ {
                              toggle_rounded_flag
                            }
                             {
                               {
                                font=@ {
                                  apply_specfont_chat
                                }
                                @ {
                                  use_specfont
                                }
                                
                              }
                              
                            }
                              {
                               {
                                scroll_desc=@ {
                                  scroll-desc
                                }
                                
                              }
                              
                            }
                              {
                               {
                                color=@ {
                                  rolltemplate_color
                                }
                                
                              }
                              
                            }
                              {
                               {
                                header_image=@ {
                                  header_image-pf_block
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_name=@ {
                                  character_name
                                }
                                
                              }
                              
                            }
                              {
                               {
                                character_id=@ {
                                  character_id
                                }
                                
                              }
                              
                            }
                              {
                               {
                                subtitle
                              }
                              
                            }
                              {
                               {
                                name=^ {
                                  npc
                                }
                                 @ {
                                  spellclass-2-name
                                }
                                 ^ {
                                  spells
                                }
                                
                              }
                              
                            }
                              {
                               {
                                concentration=@ {
                                  Concentration-2
                                }
                                
                              }
                              
                            }
                              {
                               {
                                casterlevel=@ {
                                  spellclass-2-level-total
                                }
                                
                              }
                              
                            }
                              {
                               {
                                row01=**^ {
                                  checks
                                }
                                **
                              }
                              
                            }
                              {
                               {
                                row02=[^ {
                                  caster-level-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Class-2-CL-Check) [^ {
                                  concentration-check
                                }
                                ](~@ {
                                  character_id
                                }
                                |Concentration-Check-2) [^ {
                                  spell-failure
                                }
                                ](~@ {
                                  character_id
                                }
                                |Spell-Fail-Check)
                              }
                              
                            }
                            "];getAttrs(["spellclass-0-casting_type","spellclass-1-casting_type","spellclass-2-casting_type","spellclass-0-hide_unprepared","spellclass-1-hide_unprepared","spellclass-2-hide_unprepared","spellclass-0-book","spellclass-1-book","spellclass-2-book","spellclass-0-book-npc","spellclass-1-book-npc","spellclass-2-book-npc","spellclass-0-show_domain_spells","spellclass-1-show_domain_spells","spellclass-2-show_domain_spells","spellmenu_groupby_school","spellmenu_show_uses","mythic-adventures-show"],(function(e){var t=[],a=[],l=[],u=0,p=0,d=0;try{t=[2===parseInt(e["spellclass-0-casting_type"],10),2===parseInt(e["spellclass-1-casting_type"],10),2===parseInt(e["spellclass-2-casting_type"],10)],a=[parseInt(e["spellclass-0-show_domain_spells"],10)||0,parseInt(e["spellclass-1-show_domain_spells"],10)||0,parseInt(e["spellclass-2-show_domain_spells"],10)||0],l=[parseInt(e["spellclass-0-hide_unprepared"],10)||0,parseInt(e["spellclass-1-hide_unprepared"],10)||0,parseInt(e["spellclass-2-hide_unprepared"],10)||0],u=parseInt(e.spellmenu_groupby_school,10)||0,p=parseInt(e.spellmenu_show_uses,10)||0,d=parseInt(e["mythic-adventures-show"],10)||0}catch(e){return n().error("PFSpells.resetCommandMacro, error assembling global vars",e),void r()}getSectionIDs("repeating_spells",(function(f){f&&0!==f.length?getAttrs(["_reporder_repeating_spells"],(function(m){var _;try{_=Va.chain(f).map((function(e){var t="repeating_spells_"+gn(e),a=[];return Va.each(i,(function(e){a.push(t+e)})),a})).flatten().value()}catch(e){return n().error("PFSpells.resetCommandMacro errouter",e),void r()}getAttrs(_,(function(i){var _,g,b,h,y,v,k,w=0,A=/[^\(\[]*/,C={},I=0;try{for(Va.isUndefined(m._reporder_repeating_spells)||""===m._reporder_repeating_spells?_=f:(g=m._reporder_repeating_spells.split(","),g=Va.map(g,(function(e){return e.toLowerCase()})),_=Va.intersection(Va.union(g,f),f),w=1),b=Va.chain(_).map((function(e){var t,a="",r=0,s="",c="",o=0,l="",u="",p=0,f=0,m=0,_="";try{a="repeating_spells_"+gn(e),r=(parseInt(i[a+"metamagic"],10)||0)&&i[a+"slot"]||i[a+"spell_level"],s=i[a+"school"]||"",(t=A.exec(i[a+"school"]||""))&&t[0]&&(s=(s=hn(t[0]))[0].toUpperCase()+s.slice(1).toLowerCase()),c="^ {
                              level
                            }
                             "+String(r),o=parseInt(i[a+"spell_level"],10)||0,l=parseInt(i[a+"spellclass_number"],10)||0,u="class"+(i[a+"spellclass_number"]||"0"),p=parseInt(i[a+"isDomain"],10)||0,f=d*parseInt(i[a+"isMythic"],10)||0,m=parseInt(i[a+"used"],10)||0,_=i[a+"name"]||""}catch(t){n().error("PFSpells.resetCommandMacro errmap on id "+e,t)}finally{return{id:e,level:r,levelstr:c,rawlevel:o,school:s,spellClass:l,spellClassstr:u,isDomain:p,isMythic:f,uses:m,name:_}}})).omit((function(e){return l[e.spellClass]&&t[e.spellClass]&&0===e.uses&&!(a[e.spellClass]&&e.isDomain)})).map((function(e){var a=e.name,r="",i="",s="";try{a=hn(a=dn(a=fn(a))),r=p?"("+e.uses+")":"",p&&t[e.spellClass]&&e.isDomain&&(r=""),s=e.isMythic?"&#x1f11c;
                            ":"",i=e.isDomain?"&#x1f113;
                            ":"",a=" ["+(u?e.level+":":"")+a+(r||s||i?" ":"")+i+s+r+"]"}catch(e){n().error("PFSpells.resetCommandMacro error creating link name:",e)}finally{return e.pcChatLink=a+"(~@ {
                              character_name
                            }
                            |repeating_spells_"+e.id+"_roll)",e.npcChatLink=a+"(~@ {
                              character_id
                            }
                            |repeating_spells_"+e.id+"_npc-roll)",e}})).value(),w||(b=Va.sortBy(b,"level")),b=Va.chain(b).groupBy("spellClassstr").mapObject((function(e){return Va.chain(e).sortBy(u?"school":"levelstr").groupBy(u?"school":"levelstr").value()})).value(),h={},y={},I=10,Va.each(b,(function(e,t){var a="",n="";Va.each(e,(function(e,t){I++,a+="  {
                               {
                                row"+I+"=**"+t+"**
                              }
                              
                            }
                            ",n+="  {
                               {
                                row"+I+"=**"+t+"**
                              }
                              
                            }
                            ",I++,a+="  {
                               {
                                row"+I+"=",n+="  {
                                   {
                                    row"+I+"=",Va.each(e,(function(e){a+=e.pcChatLink,n+=e.npcChatLink})),a+="
                                  }
                                  
                                }
                                ",n+="
                              }
                              
                            }
                            "})),h[t]=a,y[t]=n})),v=0;v<3;v++)(k=s[v]+h["class"+v])&&e["spellclass-"+v+"-book"].slice(13)!==k.slice(13)?C["spellclass-"+v+"-book"]=k:k||e["spellclass-"+v+"-book"].slice(13)===s[v].slice(13)||(C["spellclass-"+v+"-book"]=""),(k=c[v]+y["class"+v])&&e["spellclass-"+v+"-book-npc"].slice(13)!==k.slice(13)?C["spellclass-"+v+"-book-npc"]=k:k||e["spellclass-"+v+"-book-npc"].slice(13)===c[v].slice(13)||(C["spellclass-"+v+"-book-npc"]="");Va.size(C)>0?Ja(C,o.silentParams,r):r()}catch(e){n().error("PFSpells.resetCommandMacro",e),r()}}))})):function(e){var t=[],a=0;for(a=0;a<3;a++)e["spellclass-"+a+"-book"].slice(13)!==s[a].slice(13)&&(t["spellclass-"+a+"-book"]=s[a]),e["spellclass-"+a+"-book-npc"].slice(13)!==c[a].slice(13)&&(t["spellclass-"+a+"-book-npc"]=c[a]);Va.size(t)>0?Ja(t,o.silentParams,r):r()}(e)}))}))}function Ls(e,t,a,r){var i=Va.once((function(){"function"==typeof a&&a()}));getSectionIDs("repeating_spells",(function(e){var t=["total_spells_manually","spellclasses_multiclassed","spellclass-0-casting_type","spellclass-1-casting_type","spellclass-2-casting_type"],a=["spellclass_number","spell_level","slot","metamagic","used"];try{Va.each(e,(function(e){var n="repeating_spells_"+gn(e);Va.each(a,(function(e){t.push(n+e)}))})),Va.each(o.spellClassIndexes,(function(e){Va.each(Ns,(function(a){t.push("spellclass-"+e+"-level-"+a+"-total-listed"),t.push("spellclass-"+e+"-level-"+a+"-spells-prepared"),t.push("spellclass-"+e+"-level-"+a+"-spells-per-day")}))})),getAttrs(t,(function(t){var a={};try{a=function(e,t,a){var r=0,i=[0,0,0],s=[[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0]],c=[[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0]];try{r=parseInt(t.total_spells_manually,10)||0,i[0]=parseInt(t["spellclass-0-casting_type"],10)||0,parseInt(t.spellclasses_multiclassed,10)&&(i[1]=parseInt(t["spellclass-1-casting_type"],10)||0,i[2]=parseInt(t["spellclass-2-casting_type"],10)||0),Va.each(e,(function(e){var i,o,l="repeating_spells_"+gn(e),u=0,p=0,d=0;try{i=parseInt(t[l+"spell_level"],10)||0,u=parseInt(t[l+"spellclass_number"],10),isNaN(u)&&(u=0,a[l+"spellclass_number"]=0),p=parseInt(t[l+"metamagic"],10)||0,o=parseInt(t[l+"slot"],10),isNaN(o)?a[l+"slot"]=i:p&&o!==i?i=o:o!==i&&(o=i,a[l+"slot"]=i),c[u][i]+=1,r||(d=parseInt(t[l+"used"],10)||0,s[u][i]+=d)}catch(e){n().error("PFSpells.getSpellTotals err2",e)}})),Va.each(o.spellClassIndexes,(function(e){Va.each(Ns,(function(n){var o,l="spellclass-"+e+"-level-"+n;(parseInt(t[l+"-total-listed"],10)||0)!==c[e][n]&&(a[l+"-total-listed"]=c[e][n]),o=parseInt(t[l+"-spells-per-day"],10)||0,i[e]>0&&!r?o!==s[e][n]&&(a[l+"-spells-per-day"]=s[e][n]):0===o&&(a[l+"-spells-per-day"]=0)}))}))}catch(e){n().error("PFSpells.getSpellTotals",e)}finally{return a}}(e,t,a),Va.size(a)?Ja(a,o.silentParams,i):i()}catch(e){n().error("PFSpells.resetSpellsTotals innererror:",e),i()}}))}catch(e){n().error("PFSpells.resetSpellsTotals:",e),i()}}))}function Os(e,t,a,r,i){var s="",c="";r=r||{};try{n().debug("UPDATING SPELL ATTACK: "+e,a),c=vn(a[e+"spell-attack-type"]),a[e+"name"]&&(i||(r[t+"name"]=a[e+"name"]),r[t+"source-spell-name"]=a[e+"name"]),c&&(r[t+"attack-type"]=a[e+"spell-attack-type"],/CMB/i.test(c)?r[t+"vs"]="cmd":r[t+"vs"]="touch"),a[e+"range_numeric"]&&(r[t+"range"]=a[e+"range_numeric"]),a[e+"range"]&&"see_text"===a[e+"range_pick"]&&(s+="Range: "+a[e+"range"]),a[e+"damage-macro-text"]&&(r[t+"precision_dmg_macro"]=a[e+"damage-macro-text"],c&&(r[t+"critical_dmg_macro"]=a[e+"damage-macro-text"])),a[e+"damage-type"]&&(r[t+"precision_dmg_type"]=a[e+"damage-type"],c&&(r[t+"critical_dmg_type"]=a[e+"damage-type"])),a[e+"save"]&&(s+="\n**Save:** "+a[e+"save"],/none/.test(a[e+"save"])||(s+=" **DC:** "+a[e+"savedc"])),a[e+"sr"]&&(s&&(s+=""),s+="\n**Spell Resistance:** "+a[e+"sr"]);var o=a[e+"toggle_attack_entry"];1===o&&a[e+"name"]&&(s&&(s+=""),s+="\n[".concat(a[e+"name"],"](~@ {
                              character_name
                            }
                            |").concat(e,"roll)")),1!==o&&a[e+"name"]&&(s&&(s+=""),s+=""),s&&(r[t+"notes"]=s)}catch(e){n().error("PFSpells.setAttackEntryVals",e)}finally{return r}}function qs(e,t,a,r,i){var s=Va.once((function(){"function"==typeof t&&t()})),c=[],l="",u="",p="";try{if("DELETED"==e)return void s();u=gn(l=e||(r?mn(r.sourceAttribute):"")),p="repeating_spells_"+u,["create-attack-entry","range_pick","range","range_numeric","damage-macro-text","damage-type","sr","savedc","save"].forEach((function(e){c.push(p+e)})),["spell-attack-type","name","toggle_attack_entry"].forEach((function(e){c.push(p+e)}))}catch(t){return n().error("PFSpells.createAttackEntryFromRow erro:",t,e,r),void s()}getAttrs(c,(function(e){var t="",r={},c="repeating_weapon_",u=!0,d=!1,f={};try{n().debug("PFSpells.createAttack ##### create attack linked from spell, using ",e),0===Va.size(e)&&(u=!1),n().debug("PFSpells.createAttack ##### spellexists = "+u),u?vn(e[p+"spell-attack-type"])||e[p+"damage-macro-text"]?(t=i||generateRowID(),(r=Os(p,c+=t+"_",e,r))[c+"source-spell"]=l,r[c+"group"]="Spell",r[c+"link_type"]=io.spell):n().warn("no attack to create for spell "+e[p+"name"]+", "+l):i&&(r["repeating_weapon_"+i+"_source-spell"]="DELETED",d=!0,n().debug("seting deletedspell to "+d,r))}catch(e){n().error("PFSpells.createAttackEntryFromRow",e)}finally{d?Ja(r,o.silentParams,s):Va.size(r)>0?(r[p+"create-attack-entry"]=0,a&&(f=o.silentParams),Ja(r,f,(function(){mr(t),Tr(),s()}))):(r[p+"create-attack-entry"]=0,Ja(r,o.silentParams,s))}}))}function Hs(e,t,a,r){var i=Va.once((function(){"function"==typeof t&&t()})),s="",c="",l=[];try{s=e||(r?mn(r.sourceAttribute):""),l=[(c="repeating_spells_"+gn(s))+"range_pick",c+"range",c+"range_numeric",c+"damage-macro-text",c+"damage-type",c+"sr",c+"savedc",c+"save",c+"spell-attack-type",c+"name",c+"toggle_attack_entry"]}catch(t){return n().error("PFSpells.updateAssociatedAttack erro",t,e,r),void i()}getAttrs(l,(function(e){getSectionIDs("repeating_weapon",(function(t){var r;r=Va.reduce(t,(function(e,t){return e.push("repeating_weapon_"+t+"_source-spell"),e}),[]),getAttrs(r,(function(r){var l={},u={},p=[];try{Va.each(t,(function(t){var a="repeating_weapon_"+t+"_";r[a+"source-spell"]===s&&(p.push(t),l=Os(c,a,e,l,!0))})),a&&(u=o.silentParams)}catch(e){n().error("PFSpells.updateAssociatedAttack",e)}finally{Va.size(l)>0?Ja(l,u,(function(){_r(p)})):i()}}))}))}))}function Bs(e,t,a){var r=Va.once((function(){"function"==typeof a&&a()}));e>=0&&e<=2&&!isNaN(parseInt(e,10))?getAttrs(["spellclass-"+e+"-level-total","spellclasses_multiclassed","Concentration-"+e+"-misc-mod","spellclass-"+e+"-name","spellclass-"+e+"-SP-mod","Concentration-"+e+"-def","Concentration-"+e+"-mod","use_metrics"],(function(a){var i=parseInt(a.use_metrics)||0,s=parseInt(a["spellclass-"+e+"-level-total"],10)||0,c=parseInt(a["Concentration-"+e+"-mod"],10)||0,l=parseInt(a.spellclasses_multiclassed,10)||0,u=parseInt(a["Concentration-"+e+"-def"],10),p=parseInt(a["Concentration-"+e+"-misc-mod"],10)||0,d=parseInt(a["spellclass-"+e+"-SP-mod"],10)||0,f=(a["spellclass-"+e+"-name"],!!t&&/\-def$/i.test(t.sourceAttribute));s<=0?r():getSectionIDs("repeating_spells",(function(t){var a=["casterlevel","CL_misc","spell_class_r","spellclass_number","spellclass","range","range_numeric","range_pick","SP-mod","SP_misc","Concentration_misc","Concentration-mod","spell_options"],m=Va.reduce(t,(function(e,t){var n,r="repeating_spells_"+gn(t);return n=Va.map(a,(function(e){return r+e})),e.concat(n)}),["spellclass-0-name","spellclass-1-name","spellclass-2-name"]);getAttrs(m,(function(a){Va.after(Va.size(t),r);var m={},_={};try{Va.each(t,(function(t){var r="repeating_spells_"+gn(t),o=parseInt(a[r+"spellclass_number"],10),g=parseInt(a[r+"spell_class_r"],10),b=a[r+"range_pick"]||"",h=parseInt(a[r+"range_numeric"],10)||0,y=parseInt(a[r+"Concentration_misc"],10)||0,v=a[r+"spell_options"],k=0,w="",A=0,C=0,I=0,x=0,P="",S=0;try{isNaN(o)&&(o=0,m[r+"spellclass_number"]=0,m[r+"spellclass"]=a["spellclass-0-name"]||""),l&&o!==e||((o!==g||isNaN(g))&&(_[r+"spell_class_r"]=o),(P=a["spellclass-"+o+"-name"]||"")!==a[r+"spellclass"]&&(_[r+"spellclass"]=P,v&&(v=v.replace(As.spellclass,ws.spellclass.replace("REPLACE",dn(P))),k=1)),A=parseInt(a[r+"casterlevel"],10),(C=s+(parseInt(a[r+"CL_misc"],10)||0))<1&&(C=1),(C!==A||isNaN(A))&&(A=C,_[r+"casterlevel"]=C,v&&(v=(v=v.replace(As.casterlevel,ws.casterlevel.replace("REPLACE",C))).replace(As.casterlevel_chk,ws.casterlevel_chk.replace("REPLACE",C)),k=1)),(S=wn(a[r+"range"],b,A,i)||0)!==h&&(_[r+"range_numeric"]=S,v&&(v=v.replace(As.range,ws.range.replace("REPLACE",S)),k=1)),f&&v&&(w=u>0?ws.cast_def.replace("REPLACE",u):" {
                               {
                                cast_def=
                              }
                              
                            }
                            ",v.indexOf(" {
                               {
                                cast_def=")>=0?v=v.replace(As.cast_def,w):v+=w,k=1),(I=C+c+p+y)!==(parseInt(a[r+"Concentration-mod"],10)||0)&&(_[r+"Concentration-mod"]=I,v&&(v=(v=v.replace(As.Concentration,ws.Concentration.replace("REPLACE",I))).replace(As.Concentration_chk,ws.Concentration_chk.replace("REPLACE",I)),k=1)),(x=d+(parseInt(a[r+"SP_misc"],10)||0))!==(parseInt(a[r+"SP-mod"],10)||0)&&(_[r+"SP-mod"]=x,v&&(v=v.replace(As.spellPen,ws.spellPen.replace("REPLACE",x)),k=1)),k&&(_[r+"spell_options"]=v))}catch(e){n().error("updateSpellsCasterLevelRelated innererror on id: "+t,e)}}))}catch(e){n().error("updateSpellsCasterLevelRelated error:",e)}finally{Va.size(_)>0||Va.size(m)>0?(Va.size(m)>0&&Ja(m,{},r),Va.size(_)>0&&Ja(_,o.silentParams,r)):r()}}))}))})):r()}function Us(e,t,a){var r=Va.once((function(){"function"==typeof a&&a()}));e>=0&&e<=2&&!isNaN(parseInt(e,10))?getAttrs(["spellclass-"+e+"-level-total","Concentration-"+e+"-mod","Concentration-"+e+"-misc-mod","spellclasses_multiclassed","spellclass-"+e+"-savedc-misc","buff_SpellDC_"+e+"-total"],(function(t){var a,i,s,c,l,u;try{if(a=parseInt(t["Concentration-"+e+"-mod"],10)||0,i=parseInt(t["Concentration-"+e+"-misc-mod"],10)||0,s=parseInt(t.spellclasses_multiclassed,10)||0,c=parseInt(t["spellclass-"+e+"-savedc-misc"],10)||0,l=parseInt(t["buff_SpellDC_"+e+"-total"],10)||0,u=c+l,!parseInt(t["spellclass-"+e+"-level-total"],10))return void r();getSectionIDs("repeating_spells",(function(t){var c=[];Va.each(t,(function(e){var t="repeating_spells_"+gn(e);c=c.concat([t+"spellclass_number",t+"spell_level",t+"spell_level_r",t+"spellclass_number",t+"casterlevel",t+"DC_misc",t+"savedc",t+"Concentration-mod",t+"Concentration_misc",t+"spell_options"])})),getAttrs(c,(function(c){var l=0,p=0,d={};try{Va.each(t,(function(t){var r,o=0,f=0,m=0,_=0,g="repeating_spells_"+gn(t),b=c[g+"spell_options"],h=parseInt(c[g+"Concentration_misc"],10)||0;try{r=parseInt(c[g+"spellclass_number"],10),isNaN(r)&&(r=0,d[g+"spellclass_number"]=0),s&&r!==e||(o=parseInt(c[g+"spell_level"],10),f=parseInt(c[g+"spell_level_r"],10),isNaN(o)&&(o=0,d[g+"spell_level"]=0,n().warn("spell level was NaN for "+g)),(o!==f||isNaN(f))&&(d[g+"spell_level_r"]=o),(m=10+o+a+u+(parseInt(c[g+"DC_misc"],10)||0))!==(parseInt(c[g+"savedc"],10)||0)&&(d[g+"savedc"]=m,b&&(b=b.replace(As.dc,ws.dc.replace("REPLACE",m)),_=1)),p=parseInt(c[g+"casterlevel"],10)||0,isNaN(p)?n().warn("spell casterlevel is NaN for "+g):((l=p+a+i+h)!==(parseInt(c[g+"Concentration-mod"],10)||0)&&(d[g+"Concentration-mod"]=l,b&&(b=(b=b.replace(As.Concentration,ws.Concentration.replace("REPLACE",l))).replace(As.Concentration_chk,ws.Concentration_chk.replace("REPLACE",l)),_=1)),_&&b&&(d[g+"spell_options"]=b)))}catch(e){n().error("updateSpellsCasterAbilityRelated innererror on id:"+t,e)}}))}catch(e){n().error("updateSpellsCasterAbilityRelated miderr :",e)}finally{Va.size(d)>0?Ja(d,o.silentParams,r()):r()}}))}))}catch(e){n().error("updateSpellsCasterAbilityRelated outer error:",e)}})):r()}function js(e,t,a,r){var i,s=!1,c=Va.once((function(){s||(!function(e){var t,a="repeating_spells_"+gn(e);t=Va.map(Is,(function(e){return a+e})).concat(Cs),getAttrs(t,(function(t){var a,r=Va.chain(ks).reduce((function(e,a){return e["show"+a.toLowerCase().slice(13).replace("_notes","")]=parseInt(t[a],10)||0,e}),{}).extend({"Concentration-0-def":parseInt(t["Concentration-0-def"],10)||0,"Concentration-1-def":parseInt(t["Concentration-1-def"],10)||0,"Concentration-2-def":parseInt(t["Concentration-2-def"],10)||0}).value(),i={};n().debug("PFSPellOptions.resetOption id : "+e,r),a=Ss(e,0,r,t)||" {
                                   {
                                    condition_note=@ {
                                      condition_spell_notes
                                    }
                                    
                                  }
                                  
                                }
                                ",i["repeating_spells_"+gn(e)+"spell_options"]=a,Ja(i,{silent:!0})}))}(e),r||(Ls(),zs(),Xs(t))),"function"==typeof a&&a()})),l="",u="",p="",d="",f="",m="",_="",g="",b="",h="",y="",v=!1,k=!1,w=!1,A=!1,C=!1,I=!1,x=!1,P=!1;if(t&&t.sourceAttribute){if(!(i=t.sourceAttribute.toLowerCase().match(/name|use_metrics|toggle_casting_type|lvlstr|category|meta|range_pick|range|sp_misc|cl_misc|spellclass_number|spell_level|dc_misc|concen|slot/))||!i[0])return n().warn("Unimportant field updated, do not update row: "+t.sourceAttribute),void("function"==typeof a&&a());switch(i[0]){case"name":case"lvlstr":case"category":default:v=!0,I=!0;break;case"use_metrics":case"toggle_casting_type":case"range_pick":case"range":w=!0;break;case"sp_misc":A=!0;break;case"cl_misc":k=!0,w=!0,C=!0;break;case"spellclass_number":v=!0;break;case"concen":C=!0;break;case"spell_level":I=!0;break;case"dc_misc":x=!0;break;case"slot":case"meta":P=!0}l=gn(e),p=(u="repeating_spells_"+l)+"spellclass",d=u+"spell_class_r",f=u+"spellclass_number",m=u+"toggle_casting_type",_=u+"casterlevel",g=u+"spell_level",b=u+"spell_level_r",h=u+"DC_misc",y=u+"savedc"}else v=!0,I=!0;getAttrs([f,d,m,p,_,u+"CL_misc",u+"range_pick",u+"range",u+"range_numeric",u+"SP-mod",u+"SP_misc",u+"Concentration_misc",u+"Concentration-mod",u+"spell_options",u+"used",u+"slot",u+"metamagic",g,b,h,y,"spellclass-0-level-total","spellclass-1-level-total","spellclass-2-level-total","spellclass-0-SP-mod","spellclass-1-SP-mod","spellclass-2-SP-mod","Concentration-0-mod","Concentration-1-mod","Concentration-2-mod","Concentration-0-misc-mod","Concentration-1-misc-mod","Concentration-2-misc-mod","spellclass-0-savedc-misc","spellclass-1-savedc-misc","spellclass-2-savedc-misc","buff_SpellDC_0-total","buff_SpellDC_1-total","buff_SpellDC_2-total","Concentration-0-def","Concentration-1-def","Concentration-2-def","spellclass-0-name","spellclass-1-name","spellclass-2-name","use_metrics"],(function(t){var a,r,i,l,S,T={},E=0,D=0,M="",F=0,N=0,R=0,z=0,L=0,O=10,q=0,H="",B=0,U=0,j=0;try{r=parseInt(t[f],10),isNaN(r)&&(r=0,T[f]=0,T[d]=0,T[m]=0,v=!0),i=parseInt(t[g],10),l=parseInt(t[u+"slot"],10),isNaN(i)&&(s=!0,i=0,l=0,T[b]=0,T[u+"slot"]=0,T[g]=0,I=!0),(v||k||C||x||w||A)&&(E=r||0,D=parseInt(t[d],10)),(I||x||P||v)&&(F=i||0,N=parseInt(t[u+"metamagic"],10)||0,R=parseInt(t[b],10),N?l:F),(v||k||C||w)&&(S=parseInt(t[_],10),isNaN(S)?(k=!0,w=!0,C=!0):z=S),(v||C||x||I)&&(L=parseInt(t["Concentration-"+E+"-mod"],10)||0),(v||w||k)&&(q=parseInt(t[u+"range_numeric"],10)||0,H=t[u+"range_pick"]||"blank"),v&&(E!==D&&(T[d]=E),M=t["spellclass-"+E+"-name"]||"",t[p]!==M&&(T[p]=M)),(I||P)&&(N?l!==R&&(T[b]=l,T.spells_tab=l):(F!==R&&(T[b]=F,T.spells_tab=F),F!==l&&(T[u+"slot"]=F,l=F))),(k||v)&&((z=(parseInt(t["spellclass-"+E+"-level-total"],10)||0)+(parseInt(t[u+"CL_misc"],10)||0))<1&&(z=1),(S!==z||isNaN(S))&&(T[u+"casterlevel"]=z)),(x||I)&&(O=10+F+L+((parseInt(t["spellclass-"+E+"-savedc-misc"],10)||0)+(parseInt(t["buff_SpellDC_"+E+"-total"],10)||0))+(parseInt(t[h],10)||0))!==(parseInt(t[y],10)||0)&&(T[y]=O),(C||k||v)&&(U=z+L+(parseInt(t["Concentration-"+E+"-misc-mod"],10)||0)+(parseInt(t[u+"Concentration_misc"],10)||0))!==(parseInt(t[u+"Concentration-mod"],10)||0)&&(T[u+"Concentration-mod"]=U),a=parseInt(t.use_metrics)||0,(w||k||v)&&(j=wn(t[u+"range"],H,z,a)||0)!==q&&(T[u+"range_numeric"]=j),(A||v)&&(B=(parseInt(t["spellclass-"+E+"-SP-mod"],10)||0)+(parseInt(t[u+"SP_misc"],10)||0))!==(parseInt(t[u+"SP-mod"],10)||0)&&(T[u+"SP-mod"]=B)}catch(t){n().error("PFSpells.updateSpell:"+e,t)}finally{Va.size(T)>0?Ja(T,o.silentParams,c):c()}}))}function Ws(e){!function(e){var t=function(){"function"==typeof e&&e()};getAttrs(["spellranges_migrated"],(function(a){var n=["casterlevel","range","range_numeric","range_pick","targets","name"];1!==parseInt(a.spellranges_migrated,10)?getSectionIDs("repeating_spells",(function(a){var r;r=Va.reduce(a,(function(e,t){var a="repeating_spells_"+gn(t),r=Va.map(n,(function(e){return a+e}));return e.concat(r)}),[]),getAttrs(r,(function(n){var r={};Va.each(a,(function(e){var t,a="repeating_spells_"+gn(e),i=parseInt(n[a+"casterlevel"],10)||1,s=n[a+"range_pick"],c=n[a+"range"]||"",o=n[a+"targets"]||"",l=(n[a+"name"],0);s||c?s&&"blank"!==s||!c||(("number"===(s=(t=Sn(c,o)).dropdown)||"perlevel"===s||t.useorig)&&(c=t.rangeText),l=wn(c,s,i)||0,r[a+"range"]=c,r[a+"range_numeric"]=l,r[a+"range_pick"]=s):(r[a+"range"]="",r[a+"range_numeric"]=0,r[a+"range_pick"]="blank")})),r.spellranges_migrated="1",Va.size(r)>0?Ja(r,{silent:!0},e):t()}))})):t()}))}(e)}var Gs=n().callback((function(e,t,a){var n=Va.once((function(){"function"==typeof e&&e()})),r=Va.once((function(){getSectionIDs("repeating_spells",(function(e){var t=[];Va.each(e,(function(e){var a="repeating_spells_"+gn(e);t.push(a+"used"),t.push(a+"prepared_state")})),getAttrs(t,(function(t){var a={};Va.each(e,(function(e){var a="repeating_spells_"+gn(e),n=parseInt(t[a+"used"],10)||0,r=parseInt(t[a+"prepared_state"],10)||0,i={};n>0&&0===r?i[a+"prepared_state"]="1":n<1&&0!==r&&(i[a+"prepared_state"]="0")})),Va.size(a)&&Ja(a,o.silentParams)}))})),Ls(0,0,null),zs(),Ts(),n()})),i=Va.once((function(){getAttrs(["use_spells"],(function(e){parseInt(e.use_spells,10)?function(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=Va.after(3,t);getAttrs(["use_spells","spellclass-0-exists","spellclass-1-exists","spellclass-2-exists"],(function(e){parseInt(e.use_spells,10)?Va.times(3,(function(t){parseInt(e["spellclass-"+t+"-exists"],10)?Us(t,0,(function(){Bs(t,null,a)})):a()})):t()}))}(r):n()}))}));Ws(i)}));function Xs(e){getSectionIDs("repeating_spells",(function(e){var t=e.reduce((function(e,t){return[].concat(Ds(e),["repeating_spells_".concat(t,"_spellclass_number")])}),[]);getAttrs(["spellclass_number","spellclass-0-casting_type","spellclass-1-casting_type","spellclass-2-casting_type"].concat(Ds(t)),(function(t){var a={},n=+t["spellclass-0-casting_type"],r=+t["spellclass-1-casting_type"],i=+t["spellclass-2-casting_type"];e.forEach((function(e){var s="",c=+t["repeating_spells_".concat(e,"_spellclass_number")];0===c&&(s=n),1===c&&(s=r),2===c&&(s=i),s=1===s?0:1,a["repeating_spells_".concat(e,"_toggle_casting_type")]=s})),setAttrs(a,{silent:!0})}))}))}var Vs,$s={repeatingSpellUpdatesPlayer:["DC_misc","Concentration_misc","range","range_pick","CL_misc","SP_misc","spellclass_number","spell_level"],repeatingSpellEventsPlayer:{"change:repeating_spells:compendium_category":[function(e,t){t&&(e||(e=mn(t.sourceAttribute))),getAttrs(["repeating_spells_compendium_category","repeating_spells_spell_lvlstr","spellclass-0-name","spellclass-1-name","spellclass-2-name","repeating_spells_range_from_compendium","repeating_spells_target_from_compendium","repeating_spells_area_from_compendium","repeating_spells_effect_from_compendium","repeating_spells_description","repeating_spells_cast-time"],(function(a){var r,i,s=a.repeating_spells_spell_lvlstr,c=a.repeating_spells_range_from_compendium,l=(a.repeating_spells_target_from_compendium||"")+(a.repeating_spells_area_from_compendium||"")+(a.repeating_spells_effect_from_compendium||""),u=[],p=[],d=["","",""],f="",m=0,_=-1,g=!1,b={},h=0,y={},v="",k=!1,w=!1,A=!1,C=99,I=99,x=-1;if(n().info("at pfspells.importFromCompendium",a),!/spell/i.test(a.repeating_spells_compendium_category))return b.repeating_spells_name="Cannot parse "+a.repeating_spells_compendium_category,void setAttrs(b,o.silentParams);if(s){try{if(s=s.toLowerCase(),a["spellclass-0-name"]&&(v=a["spellclass-0-name"].toLowerCase().replace(/^\s+/,"").match(/\w+/)[0],y[v]=0,d[0]=v,/hunter/.test(v)?(k=!0,I=0):/druid/.test(v)?w=!0:/ranger/.test(v)&&(A=!0)),a["spellclass-1-name"]&&(v=a["spellclass-1-name"].toLowerCase().replace(/^\s+/,"").match(/\w+/)[0],y[v]=1,d[1]=v,/hunter/.test(v)?(k=!0,I=1):/druid/.test(v)?w=!0:/ranger/.test(v)&&(A=!0)),a["spellclass-2-name"]&&(v=a["spellclass-2-name"].toLowerCase().replace(/^\s+/,"").match(/\w+/)[0],y[v]=2,d[2]=v,/hunter/.test(v)?(k=!0,I=2):/druid/.test(v)?w=!0:/ranger/.test(v)&&(A=!0)),(!k||!w&&!A)&&Va.size(y)>0){for(Va.each(y,(function(e,t){Va.each(Rs,(function(a,n){t.indexOf(n)>=0&&(y[a]=e)}))})),u=s.split(/\s*,\s*/),p=Va.map(u,(function(e){return e.split(/\s+/)})),h=0;h<p.length;h++)p[h][1]=parseInt(p[h][1],10)||0,0===h?x=p[h][1]:x!==p[h][1]&&0;if(k){for(h=0;h<p.length;h++)/druid|ranger/.test(p[h][0])&&p[h][1]<C&&(C=p[h][1],f=p[h][0]);C<99&&(g=!0,m=C,_=I)}Va.each(y,(function(e,t){for(h=0;h<p.length;h++)p[h][0].indexOf(t)>=0&&(g||(f=d[e],m=p[h][1],_=e,g=!0))}))}}catch(e){n().error("PFSpells.importfromCompendium err2:",e),f="",g=0}try{g?b.repeating_spells_description=hn(a.repeating_spells_description):(n().warn("importFromCompendium: did not find class match"),b.repeating_spells_description="Original spell level:"+a.repeating_spells_spell_lvlstr+" \r\n"+a.repeating_spells_description,i=Va.map(p,(function(e){return e[1]})),m=Va.chain(i).countBy().pairs().max(Va.last).head().value()||0,_=0,f=d[0])}catch(e){n().error("PFSpells.importFromCompendium err3",e)}finally{m=m||0,_=_||0,f=f||d[0]||"Sorcerer",g=!0}a["repeating_spells_cast-time"]&&(b["repeating_spells_cast-time"]=a["repeating_spells_cast-time"].replace(/standard action/i,"S.A.")),b.repeating_spells_spell_level=m,b.repeating_spells_slot=m,b.repeating_spells_spell_level_r=m,b.repeating_spells_spellclass_number=_,b.repeating_spells_spell_class_r=_,b.repeating_spells_spellclass=f,b.spells_tab=m}if(c)try{r=Sn(c,l),b.repeating_spells_range_pick=r.dropdown,b.repeating_spells_range=r.rangetext,"touch"===r.dropdown?b["repeating_spells_spell-attack-type"]="attk-melee":/ranged touch|ray\s/i.test(a.repeating_spells_description)&&(b["repeating_spells_spell-attack-type"]="attk-ranged")}catch(e){n().error(e),b.repeating_spells_range=c.replace(/\s*\(..*/,""),b.repeating_spells_range_pick="unknownrange"}l&&(b.repeating_spells_targets=l),b.repeating_spells_spell_lvlstr="",b.repeating_spells_range_from_compendium="",b.repeating_spells_target_from_compendium="",b.repeating_spells_area_from_compendium="",b.repeating_spells_effect_from_compendium="",Va.size(b)>0&&Ja(b,o.silentParams,(function(){js(e,t)}))}))}],"change:repeating_spells:used":[function(e,t,a,r){var i=Va.once((function(){"function"==typeof a&&a()}));getAttrs(["total_spells_manually","repeating_spells_used","repeating_spells_spellclass_number","repeating_spells_spell_level","repeating_spells_slot","repeating_spells_metamagic"],(function(e){var a,r=0,s=0,c="",o="",l={};try{parseInt(e.total_spells_manually,10)?i():(a=parseInt(e.repeating_spells_spell_level,10)||0,r=parseInt(e.repeating_spells_spellclass_number,10),isNaN(r)&&setAttrs({repeating_spells_spellclass_number:0}),(parseInt(e.repeating_spells_metamagic,10)||0)&&(s=parseInt(e.repeating_spells_slot,10),isNaN(s)||(a=s)),o="spellclass-"+r+"-level-"+a+"-spells-prepared",l[c="spellclass-"+r+"-level-"+a+"-spells-per-day"]=0,l[o]=0,n().repeating("spells").attrs(c,o).fields("row_id","used","spell_level","metamagic","slot").reduce((function(e,t){try{(t.I.spell_level===a||t.I.metamagic&&t.I.slot===a)&&(e+=t.I.used)}catch(e){n().error("PFSpells.updateSpellsPerDay innererr",e)}finally{return e}}),0,(function(e,t,a){try{a.S[c]=e,a.S[o]=e}catch(t){n().error("ERROR calculating spells per day!",t),a&&a.I&&(a.I[c]=e,a.I[o]=e)}})).execute(i))}catch(e){n().error("PFSpells.updateSpellsPerDay  ERROR",e,t)}}))},function(e,t){getAttrs(["repeating_spells_used","repeating_spells_spellclass_number","repeating_spells_prepared_state","spellclass-0-hide_unprepared","spellclass-1-hide_unprepared","spellclass-2-hide_unprepared"],(function(e){var t=parseInt(e.repeating_spells_used,10)||0,a=parseInt(e.repeating_spells_prepared_state,10)||0,n=e.repeating_spells_spellclass_number,r=(2===(parseInt(e["spellclass-"+n+"-casting_type"],10)||0)?1:0)*(parseInt(e["spellclass-"+n+"-hide_unprepared"],10)||0),i={};t>0&&0===a?i.repeating_spells_prepared_state="1":t<1&&0!==a&&(i.repeating_spells_prepared_state="0"),isNaN(n)&&(i.repeating_spells_spellclass_number=0),Va.size(i)&&(r?Ja(i,o.silentParams,zs()):Ja(i,o.silentParams))}))},zs],"change:repeating_spells:metamagic":[function(e,t,a){var r=function(){"function"==typeof a&&a()},i="repeating_spells_"+gn(e),s=i+"spell_level_r",c=i+"slot",l=i+"spell_level",u=i+"metamagic";getAttrs([c,l,u,s],(function(i){var p,d,f,m,_=!1,g={};try{p=parseInt(i[c],10),d=parseInt(i[l],10),f=parseInt(i[u],10)||0,m=parseInt(i[s],10)||0,isNaN(d)&&(d=0,g[l]=0,g[c]=0),isNaN(p)&&(p=d,g[c]=d),f?p!==d&&(g[s]=p,g.spells_tab=p,_=!0):m!==d&&(g[s]=d,_=!0)}catch(e){n().error("PFSpells.toggleMetaMagic",e)}finally{Va.size(g)?Ja(g,o.silentParams,(function(){_?js(e,t,a):r()})):r()}}))}],"change:repeating_spells:name":[js]},repeatingSpellMenuUpdatePlayer:["name","spellclass_number","spell_level","slot","used","school","metamagic","isDomain","isMythic"],repeatingSpellAttackEventsPlayer:["range_pick","range","damage-macro-text","damage-type","save","spell-attack-type","name"],repeatingSpellAttackEventsAuto:["range_numeric","sr","savedc","toggle_attack_entry"]};Vs=[$s.repeatingSpellUpdatesPlayer,$s.repeatingSpellMenuUpdatePlayer,$s.repeatingSpellAttackEventsPlayer,$s.repeatingSpellAttackEventsAuto].reduce((function(e,t){return t.reduce((function(e,t){return e+"change:repeating_spells:"+t+" "}),e)}),""),on(Vs,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||js(null,e)}))),on("change:use_metrics",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getSectionIDs("repeating_spells",(function(t){Va.each(t,(function(t){js(t,e,null,!0)}))}))}))),Va.each($s.repeatingSpellEventsPlayer,(function(e,t){Va.each(e,(function(e){on(t,n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||e(null,t)})))}))})),on("remove:repeating_spells",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(xo(null,io.spell,mn(e.sourceAttribute)),zs(),Ls())}))),on("change:spellmenu_groupby_school change:spellmenu_show_uses change:spellclass-0-hide_unprepared change:spellclass-1-hide_unprepared change:spellclass-2-hide_unprepared change:spellclass-0-show_domain_spells change:spellclass-1-show_domain_spells change:spellclass-2-show_domain_spells",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),zs())}))),on(Vs,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||js(null,e)}))),on("change:_reporder_repeating_spells",n().callback((function(e){"player"===e.sourceType&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),zs())}))),on("change:repeating_spells:spellclass_number change:repeating_spells:spell_level",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(Ls(),function(e){var t=e.sourceAttribute.split("_")[2]||"";getAttrs(["repeating_spells_spellclass_number","spellclass-0-casting_type","spellclass-1-casting_type","spellclass-2-casting_type"],(function(e){var a={},n=+e["spellclass-0-casting_type"],r=+e["spellclass-1-casting_type"],i=+e["spellclass-2-casting_type"],s=+e.repeating_spells_spellclass_number,c="";0===s&&(c=n),1===s&&(c=r),2===s&&(c=i),c=1===c?0:1,a["repeating_spells_".concat(t,"_toggle_casting_type")]=c,setAttrs(a,{silent:!0})}))}(e))}))),on("change:repeating_spells:create-attack-entry",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||qs(null,null,!1,e)}))),on(Vs,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),_n(e.sourceAttribute),"player"!==e.sourceType&&"api"!==e.sourceType||Hs(null,null,null,e)}))),on(Vs,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),_n(e.sourceAttribute),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Hs(null,null,null,e)}))),on("change:include_link_spells",(function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),"sheetworker"!==e.sourceType&&"player"!==e.sourceType||getSectionIDs("repeating_spells",(function(e){Va.each(e,(function(e){getAttrs(["include_link_spells"],(function(t){var a=parseInt([t.include_link_spells])||0;setAttrs(Fs({},"repeating_spells_"+e+"_toggle_attack_entry",a))}))}))}))})),on("change:spellclass-0-casting_type change:spellclass-1-casting_type change:spellclass-2-casting_type",(function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Xs())}));const Ks={unarmedAttacksRegExp:/unarmed|strike|punch|palm|flurry|blow|touch/i,combatManeuversRegExp:/bull\s*rush|trip|disarm|dirty\s*trick|drag|grapple|overrun|reposition|steal|sunder|trip/i,primaryNaturalAttacksRegExp:/bite|claw|gore|slam|sting|talon/i,importantFeatRegExp:/Weapon Fine|^Run$|Enduran|Defensive Combat Train|Agile Maneuv|Arcane Arm|Combat Cast|Critical Focus|Skill Focus|Critical|Intimidating Prow|great fortitude|iron will|lightning reflexes/i,spAttackAttacks:/blooddrain|touch|energydrain|bleed|burn|constrict|trample|engulf|heat|powerfulcharge|swallowwhole|constrict/i,spAttackAttacksPreProcess:/rake|rend|web/i,abilitySrch:/str|dex|con|int|wis|cha/i,cmbMonsterSrch:/tongue|pull|drag|grab|push/i,cmbPlusStrsrch:/swallowwhole|engulf|constrict|swallow/i,masterworkWords:["adamantine","angelskin","blood-iron","cryptstone","darkleaf","darkwood","dragonhide","eel","fire-forged","frost-forged","geranite","greenwood","hellstone","horacalcum","mithral","paueliel","silversheen","singing","spiresteel","sunsilver"],casterDefaultAbility:{sorcerer:"cha",wizard:"int",cleric:"wis",bard:"cha",druid:"wis",paladin:"cha",ranger:"wis",oracle:"cha",witch:"int",alchemist:"int",summoner:"cha",inquisitor:"wis",magus:"int"},creatureTypeClassSkills:{aberration:["Acrobatics","Climb","Escape-Artist","Fly","Intimidate","Knowledge","Perception","Spellcraft","Stealth","Survival","Swim"],animal:["Acrobatics","Climb","Fly","Perception","Stealth","Swim"],dragon:["Appraise","Bluff","Climb","Craft","Diplomacy","Fly","Heal","Intimidate","Linguistics","Knowledge","Perception","Sense-Motive","Spellcraft","Stealth","Survival","Swim","Use-Magic-Device"],fey:["Appraise","Bluff","Climb","Craft","Diplomacy","Disguise","Escape-Artist","Fly","Knowledge-Geography","Knowledge-Local","Knowledge-Nature","Perception","Perform","Sense-Motive","Sleight-of-Hand","Stealth","Swim","Use-Magic-Device"],monstrous:["Climb","Craft","Fly","Intimidate","Perception","Ride","Stealth","Survival","Swim"],humanoid:["Climb","Craft","Handle-Animal","Heal","Profession","Ride","Survival"],magicalbeast:["Acrobatics","Climb","Fly","Perception","Stealth","Swim"],outsider:["Bluff","Craft","Knowledge-Planes","Perception","Sense-Motive","Stealth"],plant:["Perception","Stealth"],undead:["Climb","Disguise","Fly","Intimidate","Knowledge-Arcana","Knowledge-Religion","Perception","Sense-Motive","Spellcraft","Stealth"]},creatureSubtypeClassSkills:{air:["Fly"],giant:["Intimidate","Perception"],goblinoid:["Stealth"],inevitable:["Acrobatics","Diplomacy","Intimidate","Survival"],water:["Swim"],robot:["Climb","Disable-Device","Fly","Knowledge","Linguistics","Perception","Sense-Motive"]},specialAttackDCAbilityBase:{breathweapon:"CON",burn:"CON",curse:"CHA",disease:"CON",distraction:"CON",emotionaura:"CHA",energydrain:"CHA",entrap:"CON",fear:"CHA",fearaura:"CHA",fearcone:"CHA",fearray:"CHA",frightfulpresence:"CHA",gaze:"CHA",mentalstaticaura:"CHA",paralysis:"CON",poison:"CON",stench:"CON",trample:"STR",web:"CON",whirlwind:"STR"},monsterRulesPlusAttacks:["grab","trip","engulf","swallow whole"],naturalAttackRegExp:/arm|bite|claw|foreclaw|gore|hoof|kick|leg|pincer|quill|root|slam|slap|snake\s*bite|spike|spine|splinter|sting|tail|tail\s*slap|talon|tendril|tentacle|thorn|tongue|vine|wing|buffet/i,skillBonusFeatRegExp:/Acrobatic|Uncanny Alertness|Alertness|Animal Affinity|Athletic|Breadth of Experience|Brewmaster|Deceitful|Deft Hands|Deny the Reaper|Forgotten Past|Innocent Blood|Monkey Moves|Monkey Style|Monument Builder|No Name|Persuasive|Scavenger.s Eye|Sea Legs|Self.Sufficient|Sharp Senses|Stealthy|Sure and Fleet|Voice of the Sibyl/i,lessImportantCombatFeatRegExp:/Power Attack|Double Slice|Greater Weapon of the Chosen|Spell Focus|Toughness/i,monsterRules:/spells|damage reduction/i};var Ys=["class-ability","feat","racial-trait","trait","mythic-ability","mythic-feat","npc-spell-like-abilities"],Zs={feat:{copyAttrs:["name","short-description","used","used_max","showinmenu","description","max-calculation","ability_type"],LU:["_name","_short-description","_used","_used_max","_showinmenu","_description","_macro-text","_npc-macro-text","_max-calculation","_ability_type"],classDefault:"0",hasNPCMacro:!0,ruleCategory:"feats"},"racial-trait":{copyAttrs:["name","short-description","used","used_max","showinmenu","description","max-calculation","ability_type"],LU:["_name","_short-description","_used","_used_max","_showinmenu","_description","_macro-text","_npc-macro-text","_max-calculation","_ability_type"],hasNPCMacro:!0,classDefault:"@ {
                                  level
                                }
                                ",ruleCategory:"racial-traits"},trait:{copyAttrs:["name","short-description","used","used_max","showinmenu","description","max-calculation","ability_type"],LU:["_name","_short-description","_used","_used_max","_showinmenu","_description","_macro-text","_max-calculation","_ability_type"],classDefault:"@ {
                                  level
                                }
                                ",ruleCategory:"traits"},"class-ability":{copyAttrs:["name","short-description","used","used_max","showinmenu","description","max-calculation"],LU:["_name","_short-description","_used","_used_max","_showinmenu","_description","_macro-text","_max-calculation","_class-number"],ruleCategory:"class-features",convertClass:!0},"npc-spell-like-abilities":{copyAttrs:["name","short-description","used","used_max","showinmenu","description","max-calculation","duration","save","range"],LU:["_name","_short-description","_used","_used_max","_showinmenu","_description","_macro-text","_npc-macro-text","_max-calculation","_level","_range","_duration","_save","_sr"],hasNPCMacro:!1,classDefault:"@ {
                                  level
                                }
                                ",ruleCategory:"spell-like-abilities"}},Js={merge_traits_now:"trait",merge_race_traits_now:"racial-trait",merge_feats_now:"feat",merge_class_features_now:"class-ability",merge_slas_now:"npc-spell-like-abilities",delete_traits_now:"trait",delete_race_traits_now:"racial-trait",delete_feats_now:"feat",delete_class_features_now:"class-ability",delete_slas_now:"npc-spell-like-abilities"},Qs={"class-ability":" [^ {
                                  original-class-features-list
                                }
                                ](~@ {
                                  character_id
                                }
                                |class-ability_button)",mythic:" [^ {
                                  mythic-abilities
                                }
                                ](~@ {
                                  character_id
                                }
                                |mythic-ability_button) [^ {
                                  mythic-feats
                                }
                                ](~@ {
                                  character_id
                                }
                                |mythic-feat_button)",feat:" [^ {
                                  original-feats-list
                                }
                                ](~@ {
                                  character_id
                                }
                                |REPLACENPCfeat_button)","racial-trait":" [^ {
                                  original-racial-traits-list
                                }
                                ](~@ {
                                  character_id
                                }
                                |REPLACENPCracial-trait_button)",trait:" [^ {
                                  original-traits-list
                                }
                                ](~@ {
                                  character_id
                                }
                                |trait_button)","npc-spell-like-abilities":" [^ {
                                  original-spell-like-abilities-list
                                }
                                ](~@ {
                                  character_id
                                }
                                |npc-spell-like-abilities_button)"},ec=["name","used","used_max","showinmenu"];function tc(e){var t=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["is_npc","NPC-orig_ability_header_macro","orig_ability_header_macro","mythic-adventures-show","use_traits","use_racial_traits","use_feats","use_class_features","use_spell-like-abilities"],(function(e){var a=0,r=0,i=0,s=0,c=0,l=0,u="",p=0,d="",f={};try{d=(p=parseInt(e.is_npc,10)||0)?"NPC-":"",a=parseInt(e["mythic-adventures-show"],10)||0,s=parseInt(e.use_feats,10)||0,c=parseInt(e.use_class_features,10)||0,r=parseInt(e.use_traits,10)||0,i=parseInt(e.use_racial_traits,10)||0,l=parseInt(e["use_spell-like-abilities"],10)||0,(u=(c?Qs["class-ability"]:"")+(s?Qs.feat.replace(/REPLACENPC/g,d):"")+(l?Qs["npc-spell-like-abilities"]:"")+(r?Qs.trait:"")+(i?Qs["racial-trait"].replace(/REPLACENPC/g,d):"")+(a?Qs.mythic:""))&&(u=" {
                                   {
                                    row01=^ {
                                      original-abilities-menus
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    row02="+u+"
                                  }
                                  
                                }
                                "),u!==e[d+"orig_ability_header_macro"]&&(f[d+"orig_ability_header_macro"]=u),p&&((u=(c?Qs["class-ability"]:"")+(s?Qs.feat.replace(/REPLACENPC/g,""):"")+(l?Qs["npc-spell-like-abilities"]:"")+(r?Qs.trait:"")+(i?Qs["racial-trait"].replace(/REPLACENPC/g,""):"")+(a?Qs.mythic:""))&&(u=" {
                                   {
                                    row01=^ {
                                      original-abilities-menus
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    row02="+u+"
                                  }
                                  
                                }
                                "),u!==e.orig_ability_header_macro&&(f.orig_ability_header_macro=u))}catch(e){n().error("PFFeatures.resetTopCommandMacro",e)}finally{Va.size(f)>0?Ja(f,o.silentParams,t):t()}}))}function ac(e){var t=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["mythic-adventures-show","use_traits","use_racial_traits","use_class_features","use_feats","use_spell-like-abilities"],(function(e){var a,r=[],i=0,s=0,c=0,o=0,l=0,u=0,p=0;try{i=parseInt(e["mythic-adventures-show"],10)||0,o=parseInt(e.use_feats,10)||0,l=parseInt(e.use_class_features,10)||0,s=parseInt(e.use_traits,10)||0,c=parseInt(e.use_racial_traits,10)||0,u=parseInt(e["use_spell-like-abilities"],10)||0,o&&(r.push("feat"),p+=2),s&&(r.push("trait"),p++),c&&(r.push("racial-trait"),p+=2),i&&(r=r.concat(["mythic-ability","mythic-feat"]),p+=2),l&&(r.push("class-ability"),p++),u&&(r.push("npc-spell-like-abilities"),p++),p>0?(a=Va.after(p,t),Va.each(r,(function(e){"npc-spell-like-abilities"!==e&&yr(e,!1,a),"racial-trait"!==e&&"feat"!==e&&"npc-spell-like-abilities"!==e||yr(e,!0,a)}))):t()}catch(e){n().error("PFFeatures.resetCommandMacro",e),t()}finally{tc()}}))}function nc(e,t,a){var r=Va.once((function(t){"function"==typeof e&&e(t)})),i=Va.once((function(){"function"==typeof t?t():r()}));a?getSectionIDs("repeating_"+a,(function(e){var t,s=0;try{if("npc-spell-like-abilities"===a&&(s=1),!Va.size(e))return void r([]);t=(t=bn(["repeating_"+a+"_"],e,Zs[a].LU)).concat(["is_npc","race","class-0-name","class-1-name","class-2-name","class-3-name","class-4-name","class-5-name"]),"npc-spell-like-abilities"===a&&(t=t.concat(["spellclass-0-level-total","spellclass-1-level-total","spellclass-2-level-total","spellclass-0","spellclass-1","spellclass-2","level","npc-hd-num","class-0-level","class-1-level","class-2-level","class-3-level","class-4-level","class-5-level"])),getAttrs(t,(function(t){var c,o,l="",u=0,p="macro-text";try{u=parseInt(t.is_npc,10)||0,Zs[a].hasNPCMacro&&u&&(p="npc-macro-text"),l=Zs[a].classDefault||"",c=Va.map(e,(function(e){var r,i,c;try{return r="repeating_"+a+"_"+e+"_",(i=Va.reduce(Zs[a].copyAttrs,(function(e,a){return e[a]=t[r+a]||"",e}),{}))["CL-basis"]=l||(c=t[r+"class-number"],/\d/.test(c)?"@ {
                                  class-"+(parseInt(c.match(/\d/)[0],10)||0)+"-level
                                }
                                ":/race/i.test(c)?"@ {
                                  level
                                }
                                ":""),i["CL-basis"]?"@ {
                                  level
                                }
                                "===i["CL-basis"]?i["class-name"]=t.race:t[r+"class-number"]?i["class-name"]=t[vn(t[r+"class-number"])]:i["class-name"]="":i["class-name"]="",s&&(i["abil-sr"]=t[r+"sr"]||"",t[r+"level"]&&(o=parseInt(t[r+"level"],10),isNaN(o)||(i["spell_level-misc"]=o,i["spell_level-misc-mod"]=o,i["spell_level-basis"]="0")),t[r+"range"]&&(o=parseInt(t[r+"range"],10),i.range_pick="number",isNaN(o)||(i.range_numeric=o)),t[r+"used"]&&(o=parseInt(t[r+"used"],10),isNaN(o)||(i.used_max=o,i["max-calculation"]=o))),i["macro-text"]=t[r+p]||"",i.rule_category=Zs[a].ruleCategory,i}catch(t){n().error("PFFeatures.getAbilities errorinner on "+e,t)}}))}catch(e){n().error("PFFeatures.getAbilities errmid",e)}finally{Va.size(c)?r(c):(n().warn("PFFeatures.getAbilities none generated for "+a+" even though there are ids"),i())}}))}catch(e){n().error("PFFeatures.copyFeatsToAbilities",e),i()}})):i()}function rc(e,t,a){var r=Va.once((function(t){var n;a&&/merge/i.test(a.sourceAttribute)&&((n={})[a.sourceAttribute]=0,Ja(n,o.silentParams)),"function"==typeof e&&e(t)})),i=Va.once((function(){Ec((function(){r(),yr(t,!1),yr(t,!0)}),!0,0)}));nc((function(e){e&&Va.size(e)>0?function(e,t){var a=Va.once((function(){"function"==typeof e&&e()})),r={};Va.size(t)&&Va.each(t,(function(e){var t=function(e){var t,a={},r="",i="";try{a[(i="repeating_ability_"+(r=generateRowID())+"_")+"row_id"]=r,a[i+"showinmenu"]=e.showinmenu||0,a[i+"name"]=e.name||"",a[i+"used"]=e.used||0,a[i+"used_max"]=e.used_max||0,a[i+"max-calculation"]=e["max-calculation"]||"",a[i+"short-description"]=e["short-description"]||"",a[i+"description"]=e.description||"",a[i+"rule_category"]=e.rule_category||"",a[i+"CL-basis"]=e["CL-basis"]||"0",a[i+"class-name"]=e["class-name"]||"","spell-like-abilities"===e.rule_category?(a[i+"ability_type"]="Sp",e["spell_level-misc"]&&(a[i+"spell_level-misc"]=e["spell_level-misc"],a[i+"spell_level-misc-mod"]=e["spell_level-misc-mod"],a[i+"spell_level-basis"]=e["spell_level-basis"]),e.range_numeric&&(a[i+"range"]=e.range,a[i+"range_numeric"]=e.range_numeric,a[i+"range_pick"]=e.range_pick),e["abil-sr"]&&(a[i+"abil-sr"]=e["abil-sr"]),e.save&&(a[i+"save"]=e.save)):(t=e.name.match(/\b(Sp|Su|Ex)\b/i))&&t[1]?a[i+"ability_type"]=t[0][0].toUpperCase()+t[0][1].toLowerCase():a[i+"ability_type"]="",a[i+"macro-text"]=e["macro-text"]||""}catch(t){n().error("PFAbility.getNewAbilityAttrs",t,e)}finally{return a}}(e);Va.extend(r,t)}));Va.size(r)?Ja(r,o.silentParams,a):a()}(i,e):r()}),(function(){n().error("PFFeatures ################# error trying to migrate "+t),r()}),t)}function ic(e,t){var a=function(){"function"==typeof e&&e()},r=Va.size(Ys),i=Va.after(r,a);getAttrs(["migrated_featurelists_defaults"],(function(e){parseInt(e.migrated_featurelists_defaults,10)||0?a():Va.each(Ys,(function(e){!function(e,t){var a,r,i,s=Va.once((function(){"function"==typeof e&&e()}));i="class-abilities"===t||"npc-spell-like-abilities"===t?"1":"0",a="npc-spell-like-abilities"===t?"Sp":"not-applicable",r={feat:"feats",trait:"traits","racial-trait":"racial-traits","mythic-ability":"mythic-abilities","mythic-feat":"mythic-feats","class-ability":"class-features","npc-spell-like-abilities":"spell-like-abilities"}[t]||"",getSectionIDs("repeating_"+t,(function(e){var c={};try{(c=Va.reduce(e,(function(e,s){var c="repeating_"+t+"_"+s+"_";try{e[c+"showinmenu"]=i,e[c+"ability_type"]=a,e[c+"rule_category"]=r}catch(e){n().error("PFFeatures.setNewDefaults error "+t+" id "+s,e)}finally{return e}}),{})).migrated_featurelists_defaults=1}catch(e){n().error("PFFeatures.setNewDefaults error setting defaults for "+t,e)}finally{Va.size(c)>0?Ja(c,o.silentParams,s):s()}}))}(i,e)}))}))}var sc=n().callback((function(e,t,a){var r,i,s,c=Va.once((function(){n().info("leaving PFFeatures.recalculate"),"function"==typeof e&&e()}));try{r=Va.size(o.repeatingMaxUseSections),i=Va.after(r,(function(){ac(c)})),s=function(){Va.each(o.repeatingMaxUseSections,(function(e){!function(e,t){var a=Va.once((function(){"function"==typeof t&&t()}));getAttrs(["is_newsheet"],(function(t){parseInt(t.is_newsheet,10)?a():getSectionIDs("repeating_"+e,(function(t){var n=Va.size(t),r=Va.after(n,a);n>0?Va.each(t,(function(t,a){var n="repeating_"+e+"_"+t;an(n+"_max-calculation",n+"_used_max",0,r,!0)})):a()}))}))}(e,i)}))},ic(s)}catch(e){n().error("PFFeatures.recalculate, ",e),c()}}));function cc(e){return cc="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},cc(e)}function oc(e,t,a){return(t=function(e){var t=function(e,t){if("object"!=cc(e)||!e)return e;var a=e[Symbol.toPrimitive];if(void 0!==a){var n=a.call(e,t||"default");if("object"!=cc(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(e)}(e,"string");return"symbol"==cc(t)?t:t+""}(t))in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}on("change:merge_traits_now change:merge_race_traits_now change:merge_feats_now change:merge_class_features_now change:merge_slas_now",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs([e.sourceAttribute],(function(t){parseInt(t[e.sourceAttribute],10)&&rc(null,Js[e.sourceAttribute],e)}))}))),Va.each(o.repeatingMaxUseSections,(function(e){on("change:repeating_"+e+":max-calculation",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),an("repeating_"+e+"_max-calculation","repeating_"+e+"_used_max")})))})),on("change:mythic-adventures-show change:use_traits change:use_racial_traits change:use_class_features change:use_feats change:use_spell-like-abilities",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||tc(null)}))),Va.each(Ys,(function(e){var t="remove:repeating_"+e+" ",a="change:repeating_"+e+":";t=Va.reduce(ec,(function(e,t){return e+=a+t+" "}),t),on(t,n().callback((function(t){var a;if(a=_n(t.sourceAttribute),"player"===t.sourceType||"api"===t.sourceType||"sheetworker"===t.sourceType&&"used_max"===a){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType);var r="repeating_"+e+"_showinmenu";getAttrs([r,"is_npc"],(function(t){var n=parseInt(t.is_npc,10)||0;1!==parseInt(t[r],10)&&"showinmenu"!==a||yr(e,n)}))}})))}));var lc=["ability_type","range_numeric","frequency","abil-attack-type"],uc=["is_sp","hasposrange","hasuses","hasattack","abil-attacktypestr"].concat(lc),pc={ex:" [^ {
                                  extraordinary-abilities-menu
                                }
                                ](~@ {
                                  character_id
                                }
                                |NPCPREFIXex_button)",sp:" [^ {
                                  spell-like-abilities-menu
                                }
                                ](~@ {
                                  character_id
                                }
                                |NPCPREFIXsp_button)",su:" [^ {
                                  supernatural-abilities-menu
                                }
                                ](~@ {
                                  character_id
                                }
                                |NPCPREFIXsu_button)"},dc=["damage-macro-text","damage-type","abil-sr","save","abil-attack-type","name","range_numeric","toggle_attack_entry"],fc=["name","used","used_max","showinmenu","ability_type","frequency","rule_category","toggle_attack_entry"];function mc(e,t,a){var r=Va.once((function(){"function"==typeof t&&t()})),i="repeating_ability_"+gn(e),s=i+"CL-basis";getAttrs([i+"CL-basis",i+"class-name","character_name","race","class-0-name","class-1-name","class-2-name","class-3-name","class-4-name","class-5-name"],(function(e){var t,a="",c={};try{e[s]&&("@ {
                                  level
                                }
                                "===e[s]||"@ {
                                  npc-hd-num
                                }
                                "===e[s]?a=e.race:"(0*(@ {
                                  level
                                }
                                ))"===e[s]?"undefined"!=e[i+"class-name"]?(a=e[i+"class-name"],c[i+"CL-basis-mod"]=0):a="":0===parseInt(e[s],10)?a="":(t=e[i+"CL-basis"].match(/\d+/))&&(a=e["class-"+t[0]+"-name"]),e[i+"class-name"]!==a&&(c[i+"class-name"]=a))}catch(e){n().error("PFAbility.setClassName",e)}finally{Va.size(c)>0?Ja(c,o.silentParams,r):r()}}))}function _c(e,t,a,n){var r="repeating_ability_"+gn(a);getAttrs([r+"frequency",r+"rule_category",r+"CL-basis",r+"ability_type",r+"tabcat",r+"tabcat2","abilities_tab","npc-abilities_tab"],(function(e){var t={},a=o.silentParams;t[r+"tabcat2"]=e[r+"ability_type"]||"-1",Ja(t,a)}))}function gc(e,t,a,n){var r="repeating_ability_"+gn(a);getAttrs([r+"frequency",r+"rule_category",r+"CL-basis",r+"ability_type",r+"tabcat",r+"tabcat2","abilities_tab","npc-abilities_tab"],(function(e){var t={},a="",i=o.silentParams;switch(e[r+"rule_category"]){case"racial-traits":a="traits";break;case"monster-rule":a="other";break;case"mythic-abilities":a="mythic";break;case"mythic-feats":a="feats";break;default:a=e[r+"rule_category"]||""}a||(a="-1"),t[r+"tabcat"]=a,n&&("-1"!==a&&(e.abilities_tab===a||/Ex|Sp|Su|99/i.test(e.abilities_tab)||(t.abilities_tab=a),e["npc-abilities_tab"]===a||/Ex|Sp|Su|99/i.test(e["npc-abilities_tab"])||(t["npc-abilities_tab"]=a)),"class-features"!==e[r+"rule_category"]||e[r+"CL-basis"]&&"0"!==e[r+"CL-basis"]?"racial-traits"!==e[r+"rule_category"]||e[r+"CL-basis"]&&"0"!==e[r+"CL-basis"]||(t[r+"CL-basis"]="@ {
                                  level
                                }
                                ",i={}):(t[r+"CL-basis"]="@ {
                                  class-0-level
                                }
                                ",i={})),"spell-like-abilities"===e[r+"rule_category"]&&(e[r+"tabcat2"]="Sp",t[r+"ability_type"]="Sp"),e[r+"frequency"]||(t[r+"frequency"]="not-applicable"),Va.size(t)&&Ja(t,i,mc)}))}function bc(){getSectionIDs("repeating_ability",(function(e){Va.each(e,(function(e){gc(0,0,e),_c(0,0,e)}))}))}function hc(e,t){var a=function(t){"function"==typeof e&&e(t)},r="";try{r=" @ {
                                  orig_ability_header_macro
                                }
                                ",function(e){var t=function(t){"function"==typeof e&&e(t)};getSectionIDs("repeating_ability",(function(e){var a=[];e&&0!==Va.size(e)?(Va.each(e,(function(e){var t="repeating_ability_"+e+"_";a.push(t+"rule_category"),a.push(t+"showinmenu"),a.push(t+"ability_type")})),getAttrs(a,(function(a){var n,r=[],i=[];(n=Va.chain(e).map((function(e){var t={},n="repeating_ability_"+e+"_";return t.id=e,t.showinmenu=parseInt(a[n+"showinmenu"],10)||0,t.rule_category=a[n+"rule_category"]||"",t.ability_type=(a[n+"ability_type"]||"").toLowerCase(),t})).filter((function(e){return e.showinmenu})).value())&&(r=Va.chain(n).groupBy("rule_category").keys().compact().value(),i=Va.chain(n).groupBy("ability_type").keys().compact().value()),r||(r=[]),i||(i=[]),t({rules:r,types:i})}))):t({rules:[],types:[]})}))}((function(e){var i="",s="";try{t&&(s="NPC-"),e.types&&Va.each(e.types,(function(e){pc[e]?i+=pc[e].replace("NPCPREFIX",s):e&&n().warn("could not find top macro for "+e)})),i&&(r+="  {
                                   {
                                    row03=^ {
                                      ability-menus
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    row04="+i+"
                                  }
                                  
                                }
                                ")}catch(e){n().error("PFAbility.getTopOfMenu innererr",e)}finally{a(r)}}))}catch(e){n().error("PFAbility.getTopOfMenu",e),a(r)}}function yc(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=Va.after(8,t);hc((function(e){yr("ability",!0,a,e)}),!0),hc((function(e){yr("ability",!1,a,e)}),!1),yr("ex",!0,a),yr("sp",!0,a),yr("su",!0,a),yr("ex",!1,a),yr("sp",!1,a),yr("su",!1,a)}function vc(e,t,a,r,i){var s="",c="";r=r||{};try{c=vn(a[e+"abil-attack-type"]),a[e+"name"]&&(i||(r[t+"name"]=a[e+"name"]),r[t+"source-ability-name"]=a[e+"name"]),c&&(r[t+"attack-type"]=a[e+"abil-attack-type"],/CMB/i.test(c)?r[t+"vs"]="cmd":/ranged/i.test(c)?(r[t+"vs"]="touch",r[t+"isranged"]=1,r[t+"range"]=a[e+"range_numeric"]||0):(r[t+"vs"]="touch",r[t+"range"]=0)),a[e+"damage-macro-text"]&&(r[t+"precision_dmg_macro"]=a[e+"damage-macro-text"],r[t+"critical_dmg_macro"]=c?a[e+"damage-macro-text"]:""),a[e+"damage-type"]&&(r[t+"precision_dmg_type"]=a[e+"damage-type"],r[t+"critical_dmg_type"]=c?a[e+"damage-type"]:""),a[e+"save"]&&(s&&(s+=", "),s+="\n**Save:** "+a[e+"save"]+" **DC:** [[@ {
                                  "+e+"savedc
                                }
                                ]]"),a[e+"abil-sr"]&&(s&&(s+=", "),s+="\n**Spell Resistance:** "+a[e+"abil-sr"]);var o=a[e+"toggle_attack_entry"];1===o&&a[e+"name"]&&(s&&(s+=", "),s+="\n[".concat(a[e+"name"],"](~@ {
                                  character_name
                                }
                                |").concat(e,"roll)")),1!==o&&a[e+"name"]&&(s&&(s+=""),s+=""),s&&(r[t+"notes"]=s)}catch(e){n().error("PFAbility.setAttackEntryVals",e)}finally{return r}}function kc(e,t,a,r,i){var s,c,l,u=Va.once((function(){"function"==typeof t&&t()})),p=[];if("DELETED"!==e){if(c="repeating_ability_"+gn(s=e||(r?mn(r.sourceAttribute):"")),l=c,!s)return n().warn("Cannot create usable attack entry from SLA since we cannot identify the row id"),void u();["range_numeric","damage-macro-text","damage-type","abil-sr","savedc","save","abil-attack-type","name","toggle_attack_entry"].forEach((function(e){p.push(l+e)})),getAttrs(p,(function(e){var t="",r={},c="repeating_weapon_",p=!0,d=!1,f={};try{0===Va.size(e)&&(p=!1),p?vn(e[l+"abil-attack-type"])||e[l+"damage-macro-text"]?(t=i||generateRowID(),(r=vc(l,c+=t+"_",e,r,i))[c+"source-ability"]=s,r[c+"group"]="Special",r[c+"link_type"]=io.ability):n().warn("no attack to create for ability "+e[l+"name"]+", "+s):i&&(r["repeating_weapon_"+i+"_source-ability"]="DELETED",d=!0)}catch(e){n().error("PFAbility.createAttackEntryFromRow",e)}finally{d?Ja(r,f,u):Va.size(r)>0?(r[l+"create-attack-entry"]=0,a&&(f=o.silentParams),Ja(r,f,(function(){mr(t),Tr(),u()}))):(r[l+"create-attack-entry"]=0,Ja(r,o.silentParams,u))}}))}else u()}function wc(e,t,a,r){var i,s,c,l=Va.once((function(){"function"==typeof t&&t()})),u=[];i=e||(r?mn(r.sourceAttribute):""),s="repeating_ability_"+gn(i),u=[],(c=r?_n(r.sourceAttribute):"")?(u=[s+c],u=/range/i.test(c)?[s+"range_pick",s+"range",s+"range_numeric"]:[s+"range_pick",s+"range",s+"range_numeric",s+"damage-macro-text",s+"damage-type",s+"sr",s+"savedc",s+"save",s+"abil-attack-type",s+"name",s+"toggle_attack_entry"]):u=[s+"range_pick",s+"range",s+"range_numeric",s+"damage-macro-text",s+"damage-type",s+"sr",s+"savedc",s+"save",s+"abil-attack-type",s+"name",s+"toggle_attack_entry"],getAttrs(u,(function(e){getSectionIDs("repeating_weapon",(function(t){var r;r=Va.reduce(t,(function(e,t){return e.push("repeating_weapon_"+t+"_source-ability"),e}),[]),getAttrs(r,(function(r){var c={},u={},p=[];try{Va.each(t,(function(t){var a="repeating_weapon_"+t+"_";r[a+"source-ability"]===i&&(p.push(t),c=vc(s,a,e,c))}))}catch(e){n().error("PFAbility.updateAssociatedAttack",e)}finally{Va.size(c)>0?(a&&(u=o.silentParams),Ja(c,u,(function(){_r(p)}))):l()}}))}))}))}function Ac(e,t,a){var r=Va.once((function(){"function"==typeof t&&t()})),i="repeating_ability_"+gn(e);getAttrs([i+"CL-misc-mod",i+"CL-basis-mod",i+"casterlevel",i+"ability_type","buff_CasterLevel-total","CasterLevel-Penalty"],(function(e){var t=0,a=0,s={};try{a=parseInt(e[i+"ability_type"],10)||0,t=(parseInt(e[i+"CL-basis-mod"],10)||0)+(parseInt(e[i+"CL-misc-mod"],10)||0)+(parseInt(e["CasterLevel-Penalty"],10)||0),a&&(t+=parseInt(e["buff_CasterLevel-total"],10)||0),t!==parseInt(e[i+"casterlevel"],10)&&(s[i+"casterlevel"]=t)}catch(e){n().error("PFAbility.updateCharLevel",e)}finally{Va.size(s)?Ja(s,o.silentParams,r):r()}}))}function Cc(e,t,a,r){var i=Va.once((function(){"function"==typeof t&&t()})),s="repeating_ability_"+gn(e);getAttrs([s+"range_pick",s+"range",s+"range_numeric",s+"casterlevel",s+"ability_type"],(function(e){var t=0,a=0,r=0,c={},o=0,l=0;try{o="Sp"===e[s+"ability_type"]?1:0,a=parseInt(e[s+"range_numeric"],10)||0,o?(r=parseInt(e[s+"casterlevel"],10)||0,t=wn(e[s+"range"],e[s+"range_pick"],r)||0):t=parseInt(hn(e[s+"range"]),10)||0,t!==a&&(c[s+"range_numeric"]=t),l=parseInt(e[s+"hasposrange"],10)||0,t>0&&!l?c[s+"hasposrange"]=1:l&&(c[s+"hasposrange"]=0)}catch(e){n().error("updateAbilityRange",e)}finally{Va.size(c)?Ja(c,{},i):i()}}))}function Ic(e,t,a){var r,i=Va.once((function(){"function"==typeof t&&t()})),s="repeating_ability_"+gn(e);r=Va.map(uc,(function(e){return s+e})),getAttrs(r,(function(t){var a={};try{a=function(e,t,a){var r="repeating_ability_"+gn(t),i="",s="",c="",o="",l="",u="",p="";e=e||{};try{if(!a)return e;if((i="Sp"===a[r+"ability_type"]?"1":"")!==a[r+"is_sp"]&&(e[r+"is_sp"]=i),(s=(parseInt(a[r+"range_numeric"],10)||0)>0?"1":"")!==a[r+"hasposrange"]&&(e[r+"hasposrange"]=s),a[r+"frequency"]&&"not-applicable"!==a[r+"frequency"])switch(o="1",a[r+"frequency"]){case"perday":case"permonth":case"hexfreq":case"other":c="1"}o!==a[r+"hasfrequency"]&&(e[r+"hasfrequency"]=o),c!==a[r+"hasuses"]&&(e[r+"hasuses"]=c),vn(a[r+"abil-attack-type"])&&(l="1"),l!==a[r+"hasattack"]&&(e[r+"hasattack"]=l),l&&((u=a[r+"abil-attack-type"].toLowerCase()).indexOf("melee")>=0?p="touch":u.indexOf("range")>=0?p="ranged-touch-ray":u.indexOf("cmb")>=0&&(p="combat-maneuver-bonus-abbrv")),p!==a[r+"abil-attacktypestr"]&&(e[r+"abil-attacktypestr"]=p)}catch(e){n().error("PFAbility.recalcAbilities",e)}finally{return e}}(a,e,t)}catch(e){n().error("PFAbility.recalcAbilities",e)}finally{Va.size(a)?Ja(a,o.silentParams,i):i()}}))}function xc(e,t,a,n){var r=Va.once((function(){"function"==typeof e&&e()}));getSectionIDs("repeating_ability",(function(e){var t,a,i=Va.size(e);0!==i?(t=Va.after(i,r),a=function(e){Un("ability",e,"CL-basis","CL-basis-mod",(function(){Ac(e,(function(){mc(e),Cc(e,(function(){t()}))}))}),!0,!0)},Va.each(e,(function(e){a(e),n||Ic(e)}))):r()}))}function Pc(e){"function"==typeof e&&e()}var Sc,Tc,Ec=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFAbility.recalculate"),"function"==typeof e&&e()})),i=function(){yc(),r()};try{Pc(n().callback((function(){xc(n().callback(i)),bc()})))}catch(e){n().error("PFAbility.recalculate, ",e),r()}}));Sc="",Tc="remove:repeating_ability ",on("remove:repeating_ability",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),xo(null,io.ability,mn(e.sourceAttribute))}))),Tc=Va.reduce(fc,(function(e,t){return e+="change:repeating_ability:"+t+" "}),Tc),on(Tc,n().callback((function(e){("player"===e.sourceType||"api"===e.sourceType||/used_max/i.test(e.sourceAttribute))&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),tc(null),yc())}))),on("change:repeating_ability:CL-basis",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),an("repeating_ability_CL-basis","repeating_ability_CL-basis-mod"),"player"!==e.sourceType&&"api"!==e.sourceType||mc(null,null)}))),Sc=Va.reduce(lc,(function(e,t){return e+="change:repeating_ability:"+t+" "}),""),on(Sc,n().callback((function(e){("player"===e.sourceType||"api"===e.sourceType||/range/i.test(e.sourceAttribute))&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Ic())}))),on("change:repeating_ability:CL-misc change:repeating_ability:spell_level-misc",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),an(e.sourceAttribute,e.sourceAttribute+"-mod")}))),on("change:buff_CasterLevel-total change:CasterLevel-Penalty",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),xc(null,0,0,!0))}))),on("change:repeating_ability:CL-basis-mod change:repeating_ability:CL-misc-mod",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Ac(null,null))}))),on("change:repeating_ability:compendium_category",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),function(e,t){var a=Va.once((function(){yc(),"function"==typeof e&&e()})),r="repeating_ability_"+mn(t.sourceAttribute)+"_";getAttrs(["is_undead",r+"name",r+"compendium_category",r+"rule_category",r+"ability_type_compendium",r+"ability_type",r+"description",r+"range_from_compendium",r+"target_from_compendium",r+"area_from_compendium",r+"effect_from_compendium"],(function(e){var t,i,s="",c="",l="",u="",p={},d="",f="",m={},_="";try{if(e[r+"ability_type_compendium"]&&(c=e[r+"ability_type_compendium"],p[r+"ability_type"]=c,m[r+"ability_type_compendium"]=""),s=e[r+"compendium_category"],m[r+"compendium_category"]="",s){if("feats"===(s=s.toLowerCase())?d="feats":"monster rule"===s?d="monster-rule":"spell"===s&&(d="spell-like-abilities"),"monster-rule"===d&&e[r+"description"]&&(t=e[r+"description"].match(/Location\:\s*(.*)$/i))&&t[1]&&(u=hn(t[1].toLowerCase()),t=u.match(/special qual|sq|special att|special abil|defens|spell/i)))switch(t[0]){case"special qual":case"sq":d="special-qualities";break;case"special att":d="special-attacks";break;case"special abil":d="special-abilities";break;case"defens":d="defensive-abilities";break;case"spell":d="spell-like-abilities"}"Sp"!==c||d||(d="spell-like-abilities"),c||"spell-like-abilities"!==d?"Sp"!==c||d||(d="spell-like-abilities"):(c="Sp",p[r+"ability_type"]="Sp"),d&&(p[r+"rule_category"]=d),"Sp"===c?(_=e[r+"target_from_compendium"]||e[r+"area_from_compendium"]||e[r+"effect_from_compendium"]||"",p[r+"targets"]=_,e[r+"range_from_compendium"]&&(i=Sn(e[r+"range_from_compendium"],_),p[r+"range_pick"]=i.dropdown,p[r+"range"]=i.rangetext),p[r+"ability-basis"]="@ {
                                  CHA-mod
                                }
                                "):e[r+"name"]&&(f=(f=e[r+"name"].toLowerCase()).match(/^[^(]+/),"CON"===(l=Ks.specialAttackDCAbilityBase[f]?Ks.specialAttackDCAbilityBase[f]:"CON")&&parseInt(e.is_undead,10)&&(l="CHA"),l="@ {
                                  "+l+"
                                }
                                ",p[r+"ability-basis"]=l)}}catch(e){n().error("PFAbility.importFromCompendium",e)}finally{Va.size(m)>0&&Ja(m,o.silentParams),Va.size(p)>0?Ja(p,{},a):a()}}))}(null,e))}))),on("change:repeating_ability:create-attack-entry",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||kc(null,null,!1,e)}))),on("change:repeating_ability:CL-misc-mod change:repeating_ability:CL-basis-mod change:repeating_ability:range_pick change:repeating_ability:range",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),(/range/i.test(e.sourceAttribute)&&("player"===e.sourceType||"api"===e.sourceType)||/CL/i.test(e.sourceAttribute)&&"sheetworker"===e.sourceType||"api"===e.sourceType)&&Cc(null,null)}))),Sc=Va.reduce(dc,(function(e,t){return e+="change:repeating_ability:"+t+" "}),""),on(Sc,n().callback((function(e){("player"===e.sourceType||"api"===e.sourceType||/range_numeric/i.test(e.sourceAttribute))&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),wc(null,null,null,e))}))),on("change:repeating_ability:toggle_attack_entry",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),wc(null,null,null,e))}))),on("change:repeating_ability:rule_category",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),gc(0,0,null,e)}))),on("change:repeating_ability:ability_type",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),_c(0,0,null)}))),on("change:showinmenu_all_abilities",(function(){getSectionIDs("repeating_ability",(function(e){getSectionIDs("repeating_mythic-ability",(function(t){getSectionIDs("repeating_mythic-feat",(function(a){var n=e.map((function(e){return"repeating_ability_".concat(e,"_showinmenu")})),r=t.map((function(e){return"repeating_mythic-ability_".concat(e,"_showinmenu")})),i=a.map((function(e){return"repeating_mythic-feat_".concat(e,"_showinmenu")}));getAttrs(["showinmenu_all_abilities"],(function(e){var t=+e.showinmenu_all_abilities||0,a={};n.forEach((function(e){a[e]=t})),r.forEach((function(e){a[e]=t})),i.forEach((function(e){a[e]=t})),setAttrs(a),Ec(),sc()}))}))}))}))})),on("change:include_link_abilities",(function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),"sheetworker"!==e.sourceType&&"player"!==e.sourceType||getSectionIDs("repeating_ability",(function(e){Va.each(e,(function(e){getAttrs(["include_link_abilities"],(function(t){var a=parseInt([t.include_link_abilities])||0;setAttrs(oc({},"repeating_ability_"+e+"_toggle_attack_entry",a))}))}))}))})),on("change:repeating_ability:ability_type2",(function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType);var t=e.sourceAttribute.split("_")[2],a={},r=e.newValue.replace(/\s/g,"").toLowerCase(),i=getTranslationByKey(r);if(i){console.info({featName:r,translation:i}),a["repeating_ability_".concat(t,"_ability_type2")]=i;var s="repeating_ability_".concat(t,"_ability_type2"),c="".concat(r);getTranslationByKey(c)&&(a[s]=getTranslationByKey(c)),n().debug(a),setAttrs(a,{silent:!0})}})),on("change:repeating_ability:ability_type2 change:repeating_ability:rule_category",(function(e){n().debug("caught "+e.sourceAttribute+" event"+e.sourceType),function(e){var t=e.sourceAttribute.split("_")[2];getAttrs(["repeating_ability_macro-text","repeating_ability_ability_type2","repeating_ability_rule_category"],(function(e){var a={},r=e["repeating_ability_macro-text"],i=e.repeating_ability_ability_type2,s=e.repeating_ability_rule_category,c=/feats/g.test(s)||/traits/g.test(s)?1:0,o="";n().debug("~~~ id:".concat(t," featOrTraitCheck:").concat(c," ability_type2:").concat(i," ~~~")),0===c?/{{subtitle=.*{@{rule_category}} - @{ability_type2}}}/g.test(r)&&(o=r.replace(/{{subtitle=.*{@{rule_category}} - @{ability_type2}}}/g," {
                                   {
                                    subtitle=^ {
                                      @ {
                                        rule_category
                                      }
                                      
                                    }
                                    
                                  }
                                  
                                }
                                "),a["repeating_ability_"+t+"_macro-text"]=o):1===c&&""!==i&&/{{subtitle=.*@{rule_category}}}}/g.test(r)&&(o=r.replace(/{{subtitle=.*@{rule_category}}}}/g," {
                                   {
                                    subtitle=^ {
                                      @ {
                                        rule_category
                                      }
                                      
                                    }
                                     - @ {
                                      ability_type2
                                    }
                                    
                                  }
                                  
                                }
                                "),a["repeating_ability_"+t+"_macro-text"]=o),setAttrs(a,{silent:!0})}))}(e)}));var Dc=0,Mc=1,Fc=2,Nc=3,Rc=4;function zc(e,t){var a,n,r;if(e>=30)return 4*zc(e-10,t);switch(e){case 0:a=0,n=0,r=0;break;case 1:a=3,n=6,r=10;break;case 2:a=6,n=13,r=20;break;case 3:a=10,n=20,r=30;break;case 4:a=13,n=26,r=40;break;case 5:a=16,n=33,r=50;break;case 6:a=20,n=40,r=60;break;case 7:a=23,n=46,r=70;break;case 8:a=26,n=53,r=80;break;case 9:a=30,n=60,r=90;break;case 10:a=33,n=66,r=100;break;case 11:a=38,n=76,r=115;break;case 12:a=43,n=86,r=130;break;case 13:a=50,n=100,r=150;break;case 14:a=58,n=116,r=175;break;case 15:a=66,n=133,r=200;break;case 16:a=76,n=153,r=230;break;case 17:a=86,n=173,r=260;break;case 18:a=100,n=200,r=300;break;case 19:a=116,n=233,r=350;break;case 20:a=133,n=266,r=400;break;case 21:a=153,n=306,r=460;break;case 22:a=173,n=346,r=520;break;case 23:a=200,n=400,r=600;break;case 24:a=233,n=466,r=700;break;case 25:a=266,n=533,r=800;break;case 26:a=306,n=613,r=920;break;case 27:a=346,n=693,r=1040;break;case 28:a=400,n=800,r=1200;break;case 29:a=466,n=933,r=1400;break;default:return 0}switch(t){case Dc:return a;case Mc:return n;case Fc:return r}return 0}function Lc(e,t){var a=function(){"function"==typeof e&&e()};getAttrs(["use_metrics","load-light","load-medium","load-heavy","load-max","current-load","carried-total","max-dex-source"],(function(e){var r=0,i=0,s=0,c=0,l=0,u=0,p=0,d=0,f=0,m={},_={};try{parseInt(e.use_metrics,10);parseInt(e.use_metrics)>0&&.454,d=1===(p=parseInt(e["max-dex-source"],10)||0)||3===p?1:0,r=parseInt(e["current-load"],10)||0,d?f=Dc:(i=parseFloat(e["carried-total"])||0,s=parseFloat(e["load-light"])||0,c=parseFloat(e["load-medium"])||0,u=2*(l=parseFloat(e["load-heavy"])||0),i<=s?f=Dc:i<=c?f=Mc:i<=l?f=Fc:i<=u?f=Nc:i>u&&(f=Rc)),r!==f&&(m["current-load"]=f)}catch(e){n().error("PFEncumbrance.updateCurrentLoad",e)}finally{Va.size(m)>0?(t&&(_=o.silentParams),Ja(m,_,a)):a()}}))}function Oc(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["STR","size","size-multiplier","legs","load-light","load-medium","load-heavy","load-max","lift-above-head","lift-off-ground","lift-drag-and-push","load-str-bonus","load-multiplier","total-load-multiplier","load-misc","use_metrics"],(function(e){var r=10,i=1,s=1,c=1,l=1,u=2,p=0,d=0,f=0,m=0,_=0,g=0,b=0,h=0,y=1,v=1,k=0,w=0,A=0,C=0,I=0,x=0,P=0,S={},T={};try{r=parseInt(e.STR,10)||0,i=parseInt(e.size,10)||0,c=s=parseInt(e["size-multiplier"],10)||0,l=parseInt(e["total-load-multiplier"],10)||0,4!==(u=parseInt(e.legs,10)||0)&&(u=2),p=parseInt(e["load-light"],10)||0,d=parseInt(e["load-medium"],10)||0,f=parseInt(e["load-heavy"],10)||0,m=parseInt(e["load-max"],10)||0,_=parseInt(e["lift-above-head"],10)||0,g=parseInt(e["lift-off-ground"],10)||0,b=parseInt(e["lift-drag-and-push"],10)||0,h=parseInt(e["load-str-bonus"],10)||0,y=parseInt(e["load-multiplier"],10)||0,v=1,k=parseInt(e["load-misc"],10)||0,w=zc(r+h,Dc)+k,A=zc(r+h,Mc)+k,C=zc(r+h,Fc)+k;var E=parseInt(e.use_metrics,10)||0;if(parseInt(e.use_metrics)>0&&(E=.454,w=zc(r+h,Dc),A=zc(r+h,Mc),C=zc(r+h,Fc),w*=E,A*=E,C*=E,w=Math.round(100*w)/100,A=Math.round(100*A)/100,C=Math.round(100*C)/100,w+=k,A+=k,C+=k),y<1&&(y=1),y--,4!==u)switch(i){case-8:s=16;break;case-4:s=8;break;case-2:s=4;break;case-1:s=2;break;case 1:s=3/4;break;case 2:s=.5;break;case 4:s=1/4;break;case 8:s=1/8;break;default:s=1}else if(4===u)switch(i){case-8:s=24;break;case-4:s=12;break;case-2:s=6;break;case-1:s=3;break;case 0:s=1.5;break;case 1:s=1;break;case 2:s=3/4;break;case 4:s=.5;break;case 8:s=1/4;break;default:s=1.5}v+=y,w*=v*=s,A*=v,I=C*=v,x=2*C,P=5*C,c!==s&&(S["size-multiplier"]=s),l!==v&&(S["total-load-multiplier"]=v),p!==w&&(S["load-light"]=w),d!==A&&(S["load-medium"]=A),f!==C&&(S["load-heavy"]=C),m!==2*C&&(S["load-max"]=2*C),_!==I&&(S["lift-above-head"]=I),g!==x&&(S["lift-off-ground"]=x),b!==P&&(S["lift-drag-and-push"]=P)}catch(e){n().error("updateLoadsAndLift",e)}finally{Va.size(S)>0?(t&&(T=o.silentParams),Ja(S,T,a)):a()}}))}function qc(e){var t=["current-load","speed-base","speed-modified","speed-run","is_dwarf","max-dex-source","run-mult","buff_speed-total","condition-Slowed","run_cond_applied","condition-Entangled","condition-Fatigued","condition-Exhausted","use_metrics"];Va.each(Ri,(function(e){t.push(e+"-equipped"),t.push(e+"-type")})),getAttrs(t,(function(t){var a=parseInt(t.use_metrics,10)||0,r=parseInt(t["current-load"],10)||0,i=parseInt(t["buff_speed-total"],10)||0,s=parseInt(t["speed-base"],10)||0,c=parseInt(t["max-dex-source"],10)||0,l=isNaN(parseInt(t["run-mult"],10))?4:parseInt(t["run-mult"],10),u=0,p=0,d=s,f=l,m=s*f,_=0,g=!1,b=0,h=0,y={};try{a>0?(s=parseFloat(t["speed-base"])||0,i=parseFloat(t["buff_speed-total"])||0,d=s,m=s*f):(s=parseInt(t["speed-base"],10)||0,i=parseInt(t["buff_speed-total"],10)||0,d=s,m=s*f),s+=i,2===parseInt(t["condition-Entangled"],10)&&(u=1,s/=2,p=1),3===parseInt(t["condition-Exhausted"],10)&&(u=1,s/=2,p=1),d=s,1===parseInt(t["condition-Fatigued"],10)&&(p=1),i<0&&(u=1),3!==c&&(b=parseInt(t["armor3-equipped"],10)||0,g=parseInt(t.is_dwarf,10)||0,!b||0!==c&&1!==c||("Heavy"===t["armor3-type"]?h=2:"Medium"===t["armor3-type"]&&(h=1)),(_=Math.max(h,r))===Rc?(d=0,m=0,p=1):!g&&_>Dc&&(a>0?_===Nc?(d=.75,m=0,p=1):_!==Fc&&_!==Mc||(d=s<3?1.5:s>=3&&s<6.5?3:s>=6.5&&s<7.5?4.5:1.5*Math.ceil(Math.ceil(s/3*2)/1.5),_===Fc&&f--):_===Nc?(d=2.5,m=0,p=1):_!==Fc&&_!==Mc||(d=s<=5?5:s%15==0?2*s/3:(s+5)%15==0?2*(s+5)/3:2*(s+10)/3-5,_===Fc&&f--))),p&&(f=0),u&&(d=Math.floor(1e3*d)/1e3),m=d*f,d!==(parseInt(t["speed-modified"],10)||0)&&(y["speed-modified"]=d),m!==(parseInt(t["speed-run"],10)||0)&&(y["speed-run"]=m),u!==(parseInt(t["condition-Slowed"],10)||0)&&(y["condition-Slowed"]=u),l>f&&(p=1),p!==(parseInt(t.run_cond_applied,10)||0)&&(y.run_cond_applied=p)}catch(e){n().error("PFEncumbrance.updateModifiedSpeed",e)}finally{Va.size(y)>0?Ja(y,o.silentParams,e):"function"==typeof e&&e()}}))}function Hc(e){var t=function(){"function"==typeof e&&e()};getAttrs(["max-dex-source"],(function(e){var a=parseInt(e["max-dex-source"],10);isNaN(a)?Ja({"max-dex-source":0},o.silentParams,t):t()}))}var Bc=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFEncumbrance.recalculate"),"function"==typeof e&&e()})),i=Va.once((function(){qc(r)})),s=Va.once((function(){Lc(i)})),c=Va.once((function(){Oc(s,t)}));try{Hc(c)}catch(e){n().error("PFEncumbrance.recalculate",e),r()}}));on("change:speed-base change:race change:armor3-equipped change:max-dex-source change:run-mult",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||qc()}))),on("change:is_dwarf change:current-load change:armor3-equipped change:armor3-type",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||qc()}))),on("change:load-light change:carried-total",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Lc()}))),on("change:size-multiplier change:legs change:load-str-bonus change:load-multiplier change:load-misc",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Oc())}))),on("change:use_metrics",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Oc(),Lc(),qc())}))),on("change:STR change:size",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Oc()})));var Uc={0:4,1:3,2:2,"-8":8,4:1,"-4":7,"-2":6,"-1":5,8:0},jc={0:8,1:4,2:2,3:1,4:0,5:-1,6:-2,7:-4,8:-8},Wc={0:0,1:2,2:4,8:8,4:6,"-8":-8,"-4":-6,"-2":-4,"-1":-2},Gc={colossal:-8,gargantuan:-4,huge:-2,large:-1,medium:0,small:1,tiny:2,diminutive:4,fine:8},Xc={0:"medium",1:"small",2:"tiny","-8":"colossal",4:"diminutive","-4":"gargantuan","-2":"huge","-1":"large",8:"fine"};function Vc(e,t){return Uc[String(e)]-Uc[String(t)]}function $c(e,t){var a={};try{(a=function(e){var t={size:0,skillSize:0};try{e&&(e=(e=hn(e)).toLowerCase(),t.size=Gc[e],t.skillSize=Wc[String(t.size)])}catch(a){n().error("get size from text:"+e,a),t.size=0,t.skillSize=0}finally{return t}}(e))&&0!==a.size?(t.size=a.size,t.default_char_size=a.size,t.size_skill=a.skillSize,t["CMD-size"]=-1*a.size,t.size_skill_double=2*a.skillSize):(t.size=0,t.default_char_size=0,t.size_skill=0,t["CMD-size"]=0,t.size_skill_double=0,a||(a={size:0,skillSize:0})),t.size_display=Qa(e.toLowerCase())}finally{return a}}function Kc(e,t,a,r){var i=0,s=0,c=0,o=0;try{r=r||{},i=s=parseInt(t.default_char_size,10)||0,0!==e&&(c=Uc[String(s)],i=jc[String(c+e)]),i!==(parseInt(t.size,10)||0)?(r.size=i,r["CMD-size"]=-1*i,o=Wc[String(i)],r.size_skill=o,r.size_skill_double=2*o):((parseInt(t["CMD-size"],10)||0)!==-1*i&&(r["CMD-size"]=-1*i),o=Wc[String(i)],(parseInt(t.size_skill,10)||0)!==o&&(r.size_skill=o),(parseInt(t.size_skill_double,10)||0)!==2*o&&(r.size_skill_double=2*o)),function(e,t,a){var n;a=a||{},!(n=Qa(Xc[String(e)]))||n===t.size_display&&t.size_display||(a.size_display=n)}(i,t,r)}catch(e){n().error("PFSize.updateSize",e)}finally{return n().debug("PFSize.updateSize returning with  ",r),r}}function Yc(e,t,a){var r=function(t){"function"==typeof e&&e(t)};getAttrs(["size","size_skill","size_skill_double","default_char_size","CMD-size","buff_size-total","size_display"],(function(e){var i={},s={},c=0,l=0,u=0,p=0;try{a&&"buff_size-total"===a.sourceAttribute?Kc(c=parseInt(e["buff_size-total"],10)||0,e,0,s):a&&"size"!==a.sourceAttribute?"default_char_size"===a.sourceAttribute?(l=parseInt(e.size,10)||0,u=parseInt(e.default_char_size,10)||0,c=Vc(l,u)):n().warn("Called updateSizeAsync with unexpected event:",a):(0===(c=parseInt(e["buff_size-total"],10)||0)&&(l=parseInt(e.size,10)||0,u=parseInt(e.default_char_size,10)||0,0===(c=Vc(l,u))&&a&&(parseInt(a.previousValue,10)||0)!==(parseInt(a.newValue,10)||0)&&(p=(parseInt(a.newValue,10)||0)-(parseInt(a.previousValue,10)||0))),Kc(c,e,0,s))}catch(e){n().error("PFSize.updateSizeAsync",e)}finally{Va.size(s)>0?(t&&(i=o.silentParams),Ja(s,i,(function(){r(c)}))):r(0!==c||0!==p?1:0)}}))}function Zc(e){Yc((function(t){t&&(Oc(),bo(null,e))}),!1,e),Oc(),bo(null,e)}var Jc=n().callback((function(e,t,a){Yc(Va.once((function(){n().info("leaving PFSize.recalculate"),"function"==typeof e&&e()})),t,null)}));function Qc(e){return Qc="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},Qc(e)}function eo(e,t,a){return(t=function(e){var t=function(e,t){if("object"!=Qc(e)||!e)return e;var a=e[Symbol.toPrimitive];if(void 0!==a){var n=a.call(e,t||"default");if("object"!=Qc(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(e)}(e,"string");return"symbol"==Qc(t)?t:t+""}(t))in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}on("change:size change:default_char_size",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),n().debug(e),"player"===e.sourceType&&Zc(e)}))),on("change:size change:buff_size-total",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Zc(e)})));var to=["_damage-ability-max","_damage-ability","_damage-ability-mod","_damage-mod","_damage_ability_mult","_enhance","_total-damage","_attack-type","_isranged","buff_dmg_power_attack-total"],ao=["_attack-mod","_attack-type","_attack-type-mod","_crit_conf_mod","_crit_confirm","_crit_confirm_temp","_isranged","_masterwork","_proficiency","_total-attack","_attack-type_macro_insert","_damage-type_macro_insert"].concat(to),no=["_default_damage-dice-num","_default_damage-die","_default_size","_not_default_size","_damage-dice-num","_damage-die","_size_affects"],ro=["attk_ranged_crit_conf","attk_ranged2_crit_conf","attk_melee_crit_conf","attk_melee2_crit_conf","attk_cmb_crit_conf","attk_cmb2_crit_conf","buff_DMG-total","buff_dmg_melee-total","buff_dmg_ranged-total","buff_dmg_melee2-total","buff_dmg_ranged2-total","condition-Sickened","size","default_char_size","modify_dmg_by_size","buff_dmg_power_attack-total","buff_crit_conf-total"],io={equipment:1,spell:2,ability:3,weapon:4};function so(e){var t=1;return e&&((t=Number(String(e).replace(",",".")))||(t=1)),t}function co(e,t,a,n){var r=(t||0)-(a||0);0!==r&&getAttrs(["repeating_weapon_total-attack"],(function(e){var t=parseInt(e["repeating_weapon_total-attack"],10)||0;setAttrs({"repeating_weapon_total-attack":t+=r},o.silentParams,n)}))}function oo(e,t){var a=function(){mr(e)},r=gn(e),i="repeating_weapon_"+r+"attack-type",s="repeating_weapon_"+r+"enhance",c="repeating_weapon_"+r+"masterwork",l="repeating_weapon_"+r+"attack-type-mod",u="repeating_weapon_"+r+"proficiency",p="repeating_weapon_"+r+"attack-mod",d="repeating_weapon_"+r+"total-attack";getAttrs([s,c,i,l,u,p,d],(function(e){var t=0,r=0,f=0,m=0,_=0,g=0,b=0,h={};try{_=parseInt(e[p],10)||0,g=parseInt(e[d],10)||0,"dual"===e[i]?b=_:(t=parseInt(e[s],10)||0,r=parseInt(e[c],10)||0,f=parseInt(e[l],10)||0,m=parseInt(e[u],10)||0,_=parseInt(e[p],10)||0,b=Math.max(t,r)+f+m+_),(b!==g||isNaN(g))&&(h[d]=b,Ja(h,o.silentParams,a))}catch(e){n().error("PFAttacks.updateRepeatingWeaponAttack")}}))}function lo(e,t,a,n){var r=(t||0)-(a||0);0!==r&&getAttrs(["repeating_weapon_".concat(e,"_total-damage")],(function(t){var a=parseInt(t["repeating_weapon_".concat(e,"_total-damage")],10)||0;a+=r,setAttrs(eo({},"repeating_weapon_".concat(e,"_total-damage"),a),o.silentParams,n)}))}function uo(e,t){var a=function(){mr(e)},r=gn(e),i="repeating_weapon_"+r+"damage-ability-max",s="repeating_weapon_"+r+"damage-ability-mod",c="repeating_weapon_"+r+"total-damage",l="repeating_weapon_"+r+"enhance",u="repeating_weapon_"+r+"damage-mod",p="repeating_weapon_"+r+"damage_ability_mult",d="repeating_weapon_"+r+"attack-type",f="repeating_weapon_"+r+"isranged";t&&t.sourceAttribute.toLowerCase().indexOf("buff_dmg_range"),getAttrs([i,s,"buff_DMG-total","buff_dmg_melee-total","buff_dmg_ranged-total","buff_dmg_melee2-total","buff_dmg_ranged2-total","buff_dmg_power_attack-total","condition-Sickened",f,c,d,l,u,p],(function(e){var t,r,f,m,_,g,b,h,y,v,k=0,w={},A=0,C=0;(y=/range/i.test(e[d]))||(A=/melee/i.test(e[d])),v=/2/.test(e[d]),r=parseInt(e[s],10)||0,f=1,_=parseInt(e["condition-Sickened"],10)||0,m=parseInt(e[c],10),g=parseInt(e[u],10)||0,b=parseInt(e[l],10)||0,y?(k=parseInt(e["buff_dmg_ranged-total"],10)||0,C=0,v&&(k+=parseInt(e["buff_dmg_ranged2-total"],10)||0,C=0)):A?(k=parseInt(e["buff_dmg_melee-total"],10)||0,C=parseInt(e["buff_dmg_power_attack-total"],10)||0,v&&(k+=parseInt(e["buff_dmg_melee2-total"],10)||0)):k=0,k+=parseInt(e["buff_DMG-total"],10)||0,f=so(e[p])||1,k-=_,t=parseInt(e[i],10),y&&!isNaN(t)||(t=999),r<=0&&(f=1,n().debug("~~~~~~ Multiplier only applies to an Ability bonus. Current Ability-Mod: "+r)),((h=Math.floor(Math.min(f*(r+C),t))+k+g+b)!==m||isNaN(m))&&(w[c]=h),Va.size(w)&&Ja(w,o.silentParams,a)}))}function po(e,t,a,r){var i=gn(e),s="repeating_weapon_"+i+"crit_conf_mod",c="repeating_weapon_"+i+"crit_confirm",o="repeating_weapon_"+i+"crit_confirm_temp",l="repeating_weapon_"+i+"attack-type",u=t["buff_crit_conf-total"]||0,p=(t[o],0),d="",f="",m=0,_=0;try{a=a||{},p=t[c]||0,(r||"0"!==t[l]&&"dual"!==t[l])&&(d=t[l].replace("attk-",""),(r||vr[d])&&(f=vr[d].crit),(r||f)&&(m=t[f]||0)),_=p+m+u,a[s]=_}catch(t){n().error("updateRepeatingWeaponCrit: error updating crit for id  "+e,t)}finally{return a}}function fo(e,t){var a=vr[e]?vr[e].crit:"";a?getSectionIDs("repeating_weapon",(function(t){var r=[a,"buff_crit_conf-total"];!t||Va.size(t)<1||(Va.each(t,(function(e){var t=gn(e);r.push("repeating_weapon_"+t+"crit_conf_mod"),r.push("repeating_weapon_"+t+"crit_confirm"),r.push("repeating_weapon_"+t+"crit_confirm_temp"),r.push("repeating_weapon_"+t+"attack-type")})),getAttrs(r,(function(r){parseInt(r[a],10);var i={};try{r=Va.mapObject(r,(function(e,t){return/attack\-type$/i.test(t)||/damage\-ability$/i.test(t)||/damage\-ability\-max$/i.test(t)||/damage_ability_mult$/i.test(t)?e:parseInt(e,10)||0})),Va.each(t,(function(t){var a=gn(t);r["repeating_weapon_"+a+"attack-type"]==="attk-"+e&&po(t,r,i,!0)}))}catch(e){n().error("updateRepeatingWeaponsFromCritAsync: error",e)}finally{Va.size(i)>0&&Ja(i,o.silentParams)}})))})):n().error("updateRepeatingWeaponsFromCritAsync: Invalid attack type")}function mo(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));getSectionIDs("repeating_weapon",(function(e){var t;(t=bn(["repeating_weapon_"],e,to)).push("buff_DMG-total"),t.push("buff_dmg_melee-total"),t.push("buff_dmg_ranged-total"),t.push("buff_dmg_melee2-total"),t.push("buff_dmg_ranged2-total"),t.push("condition-Sickened"),t.push("buff_dmg_power_attack-total"),getAttrs(t,(function(t){var a;t["buff_DMG-total"]=parseInt(t["buff_DMG-total"],10)||0,t["buff_dmg_ranged-total"]=parseInt(t["buff_dmg_ranged-total"],10)||0,t["buff_dmg_melee-total"]=parseInt(t["buff_dmg_melee-total"],10)||0,t["condition-Sickened"]=parseInt(t["condition-Sickened"],10)||0,t["buff_dmg_power_attack-total"]=parseInt(t["buff_dmg_power_attack-total"],10)||0,a=Va.reduce(e,(function(e,a){var r=function(e,t){var a="repeating_weapon_"+gn(e),r=t[a+"damage-ability"],i=0,s=0,c=0,o=1,l=0,u=0,p=999,d=t["condition-Sickened"],f=t["buff_dmg_melee-total"]||0,m=t["buff_dmg_ranged-total"]||0,_=t["buff_DMG-total"]||0,g=t["buff_dmg_power_attack-total"]||0,b=0,h={};try{"dual"===r?0!==l&&(h[a+"total-damage"]=0):(i=parseInt(t[a+"isranged"],10)||0,s=parseInt(t[a+"enhance"],10)||0,c=parseInt(t[a+"damage-ability-mod"],10)||0,l=parseInt(t[a+"total-damage"],10)||0,u=parseInt(t[a+"damage-mod"],10)||0,t[a+"attack-type"].indexOf("2")>=0&&(m+=parseInt(t["buff_dmg_ranged2-total"],10)||0,f+=parseInt(t["buff_dmg_melee2-total"],10)||0),i?(g=0,_+=m,p=parseInt(t[a+"damage-ability-max"],10),isNaN(p)&&(p=999)):_+=f,o=so(t[a+"damage_ability_mult"]),_-=d,c<=0&&(o=1,n().debug("~~~~~~ Multiplier only applies to an Ability bonus. Current Ability-Mod: "+c)),((b=Math.floor(Math.min(o*(c+g),p))+_+u+s)!==l||isNaN(l))&&(h[a+"total-damage"]=b))}catch(t){n().error("PFAttacks.recalculateAttack for id "+e,t)}finally{return h}}(a,t);return Va.extend(e,r),e}),{}),Va.size(a)?Ja(a,{},r):r()}))}))}function _o(e,t,a,n,r){return r||(r="repeating_weapon_"+gn(e)),n&&parseInt(t[r+"size_affects"],10)||(a[r+"default_damage-dice-num"]=t[r+"damage-dice-num"]||0,a[r+"default_damage-die"]=t[r+"damage-die"]||0),a}function go(e,t,a,r,i){var s=0,c=0,o=0,l=0,u=0,p=0,d=0,f=0,m=0,_={};try{i||(i="repeating_weapon_"+gn(e)),d=parseInt(a[i+"not_default_size"],10)||0,parseInt(a[i+"size_affects"],10)?(s=parseInt(a[i+"damage-dice-num"],10)||0,l=parseInt(a[i+"damage-die"],10)||0,0!==s&&0!==l?(f=parseInt(a.default_char_size,10),p=parseInt(a[i+"default_size"],10),c=parseInt(a[i+"default_damage-dice-num"],10)||0,u=parseInt(a[i+"default_damage-die"],10)||0,isNaN(p)&&(p=f,r[i+"default_size"]=p),isNaN(f)&&(f=t),0!==c&&0!==u||(c=s,u=l,r[i+"default_damage-dice-num"]=c,r[i+"default_damage-die"]=u),t!==f&&(d||(r[i+"not_default_size"]=1),m=Vc(t,f)),p!==f&&(d||(r[i+"not_default_size"]=1),o=Vc(p,f)),m+=o,n().debug("PFAttacks update dice, total size change is  "+m),m?(_=function(e,t,a,r){var i,s={1:["1d1"],2:["1d2"],3:["1d3"],4:["1d4"],5:["1d6"],6:["1d8","2d4"],7:["1d10"],8:["2d6","3d4","1d12"],9:["2d8","4d4"],10:["3d6","5d4"],11:["3d8","6d4","2d10"],12:["4d6","7d4","2d12"],13:["4d8","8d4","9d4","5d6","3d10"],14:["6d6","5d8","10d4","11d4","9d4","3d12"],15:["6d8","7d6","12d4","13d4","4d10"],16:["8d6","7d8","14d4","15d4","4d12"],17:["8d8","16d4","9d6","10d6","11d6","5d10","17d4","18d4","19d4","5d12"],18:["12d6","20d4","9d8","7d10","6d12","21d4","22d4","23d4"],19:["12d8","24d4","13d6","14d6","15d6","8d10"],20:["16d6","13d8","10d10","8d12"]},c=0,o="",l=0,u=0,p=0,d=Va.reduce(s,(function(e,t,a){return Va.each(t,(function(t){e[t]=a})),e}),{});try{if(a=parseInt(a,10),r=parseInt(r,10),!isNaN(a)&&!isNaN(r)){if(o=a+"d"+r,c=Uc[String(t)],a<=0||r>12)return null;if(4===r&&a>24?a=24:6===r&&a>16?a=16:8===r&&a>13?a=13:10===r&&a>10?a=10:12===r&&a>8&&(a=8),!(u=parseInt(d[o],10)||0))return null;for(;0!==e;)if(e>0?l=r<=6&&1===a||c<=3?1:2:e<0&&(l=r<=8&&1===a||c<=4?-1:-2),p=u+l,i=(o=s[p=Math.min(Math.max(p,1),20)][0]).match(/(\d+)d(\d+)/),a=parseInt(i[1],10),r=parseInt(i[2],10),u=p,e>0){if(c++,e--,u>=20){n().warn("PFSize.updateDamageDice increased off top of grid to row "+u);break}}else if(c--,e++,u<=1){n().warn("PFSize.updateDamageDice decreased under bottom of grid to row "+u);break}}}catch(e){n().error("updateDamageDice: ",e)}finally{return{dice:a,die:r}}}(m,f,c,u),n().debug("###########","PFAttacks.adjustDamageDice NEW DAMAGE is:"+_.dice+"d"+_.die+", for sizeDiff:"+m),s===_.dice&&l===_.die||(r[i+"damage-dice-num"]=_.dice,r[i+"damage-die"]=_.die)):(d&&(r[i+"not_default_size"]=0),s===c&&l===u||(r[i+"damage-dice-num"]=c,r[i+"damage-die"]=u))):r[i+"size_affects"]=0):0!==s&&0!==l&&(r[i+"damage-dice-num"]=a[i+"default_damage-dice-num"],r[i+"damage-die"]=a[i+"default_damage-die"],d&&(r[i+"not_default_size"]=0))}catch(e){n().error("PFAttacks.adjustDamageDice",e)}finally{return r}}function bo(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["modify_dmg_by_size","size","default_char_size"],(function(e){var t=0;parseInt(e.modify_dmg_by_size,10)&&(t=parseInt(e.size,10)||0,getSectionIDs("repeating_weapon",(function(n){var r;Va.size(n)&&(r=bn(["repeating_weapon_"],n,no),getAttrs(r,(function(r){var i={};r.default_char_size=parseInt(e.default_char_size,10)||0,Va.each(n,(function(e){gn(e);go(e,t,r,i)})),Va.size(i)&&Ja(i,o.silentParams,a)})))})))}))}function ho(e,t,a,r){var i=1,s=2,c="",o=" {
                                   {
                                    attackREPLACEITER=[[ 1d20cs>[[ @ {
                                      repeating_weapon_REPLACEHAND_crit-target
                                    }
                                     ]] + [[ @ {
                                      repeating_weapon_REPLACEHAND_attack_macro
                                    }
                                     ]] + @ {
                                      iterative_attackREPLACEITER_value
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    damageREPLACEITER=[[ @ {
                                      repeating_weapon_REPLACEHAND_damage-dice-num
                                    }
                                    d@ {
                                      repeating_weapon_REPLACEHAND_damage-die
                                    }
                                     + @ {
                                      repeating_weapon_REPLACEHAND_damage_macro
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    typeREPLACEITER=@ {
                                      typeREPLACEITER
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    crit_confirmREPLACEITER=[[ 1d20 + [[ @ {
                                      repeating_weapon_REPLACEHAND_attack_macro
                                    }
                                      ]] + @ {
                                      iterative_attackREPLACEITER_value
                                    }
                                     + @ {
                                      repeating_weapon_REPLACEHAND_crit_conf_mod
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    crit_damageREPLACEITER=[[ [[ @ {
                                      repeating_weapon_REPLACEHAND_damage-dice-num
                                    }
                                     * [[ @ {
                                      repeating_weapon_REPLACEHAND_crit-multiplier
                                    }
                                     - 1 ]] ]]d@ {
                                      repeating_weapon_REPLACEHAND_damage-die
                                    }
                                     + ((@ {
                                      repeating_weapon_REPLACEHAND_damage_macro
                                    }
                                    ) * [[ @ {
                                      repeating_weapon_REPLACEHAND_crit-multiplier
                                    }
                                     - 1 ]]) ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmgREPLACEITER1=@ {
                                      repeating_weapon_REPLACEHAND_precision_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmgREPLACEITER1=@ {
                                      repeating_weapon_REPLACEHAND_critical_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmgREPLACEITER2=@ {
                                      global_precision_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmgREPLACEITER2=@ {
                                      global_critical_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    attackREPLACEITERname=@ {
                                      iterative_attackREPLACEITER_name
                                    }
                                    
                                  }
                                  
                                }
                                 ",l=0,u="",p=[],d=0,f=0,m=0,_=0,g="",b="",h="";try{for(n().debug("PFAttacks.setDualWieldVals",e),t=t||{},a||(a=generateRowID()),g="repeating_weapon_"+a+"_",r&&(u=e["macro-text"],n().debug("currMacro is ",u),u&&(n().debug("about to call gettracking"),p=Kn(u),0===Va.size(p)&&(u=e["NPC-macro-text"])&&(p=Kn(u)))),m=e.offhand_improved,(b=Qa("dual-wield"))||(b="Dual Wield"),t[g+"dualwield"]=1,t[g+"source-main"]=e.mainhand_id,t[g+"source-off"]=e.offhand_id,t[g+"group"]=b,r||(t[g+"group"]=b,t[g+"source-main-name"]=e.mainhand_name||"",t[g+"source-off-name"]=e.offhand_name||"",t[g+"name"]=b+" "+(e.mainhand_name||"")+"/"+(e.offhand_name||""),t[g+"iterative_attack1_name"]=e.mainhand_name+" [[@ {
                                  repeating_weapon_"+e.mainhand_id+"_total-attack
                                }
                                 + "+e.mainhand_penalty+"]]"),t[g+"link_type"]=io.weapon,t[g+"size_affects"]=0,t[g+"attack-type"]="dual",t[g+"attack-type-mod"]=0,t[g+"damage-ability"]="dual",t[g+"damage-ability-mod"]=0,t[g+"damage"]="0",t[g+"damage-mod"]=0,i=1,t[g+"damage"]="0",t[g+"damage-mod"]=0,c="& {
                                  template:pf_attack
                                }
                                 @ {
                                  toggle_attack_accessible
                                }
                                 @ {
                                  toggle_rounded_flag
                                }
                                  {
                                   {
                                    header_image=@ {
                                      header_image-pf_attack-dual
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    font=@ {
                                      apply_specfont_chat
                                    }
                                    @ {
                                      use_specfont
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    scroll_desc=@ {
                                      scroll-desc
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    color=@ {
                                      rolltemplate_color
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    character_name=@ {
                                      character_name
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    character_id=@ {
                                      character_id
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    subtitle
                                  }
                                  
                                }
                                  {
                                   {
                                    name=@ {
                                      name
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    attack=[[ 1d20cs>[[ @ {
                                      repeating_weapon_"+e.mainhand_id+"_crit-target
                                    }
                                     ]] + [[@ {
                                      repeating_weapon_"+e.mainhand_id+"_attack_macro
                                    }
                                     ]] + @ {
                                      attack-mod
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    damage=[[@ {
                                      repeating_weapon_"+e.mainhand_id+"_damage-dice-num
                                    }
                                    d@ {
                                      repeating_weapon_"+e.mainhand_id+"_damage-die
                                    }
                                     + @ {
                                      repeating_weapon_"+e.mainhand_id+"_damage_macro
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    type=@ {
                                      type
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    crit_confirm=[[ 1d20 + [[ @ {
                                      repeating_weapon_"+e.mainhand_id+"_attack_macro
                                    }
                                     ]] + @ {
                                      attack-mod
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    crit_damage=[[ [[ @ {
                                      repeating_weapon_"+e.mainhand_id+"_damage-dice-num
                                    }
                                     * (@ {
                                      repeating_weapon_"+e.mainhand_id+"_crit-multiplier
                                    }
                                     - 1) ]]d@ {
                                      repeating_weapon_"+e.mainhand_id+"_damage-die
                                    }
                                     + ((@ {
                                      repeating_weapon_"+e.mainhand_id+"_damage_macro
                                    }
                                     ) * [[ @ {
                                      repeating_weapon_"+e.mainhand_id+"_crit-multiplier
                                    }
                                     - 1 ]]) ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmg1=@ {
                                      repeating_weapon_"+e.mainhand_id+"_precision_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmg1_type=@ {
                                      repeating_weapon_"+e.mainhand_id+"_precision_dmg_type
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmg1=@ {
                                      repeating_weapon_"+e.mainhand_id+"_critical_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmg1_type=@ {
                                      repeating_weapon_"+e.mainhand_id+"_critical_dmg_type
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    weapon_notes=@ {
                                      repeating_weapon_"+e.mainhand_id+"_notes
                                    }
                                    @ {
                                      repeating_weapon_"+e.offhand_id+"_notes
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    vs=@ {
                                      repeating_weapon_"+e.mainhand_id+"_vs
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    vs@ {
                                      repeating_weapon_"+e.mainhand_id+"_vs
                                    }
                                    =@ {
                                      repeating_weapon_"+e.mainhand_id+"_vs
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmg2=@ {
                                      global_precision_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmg2_type=@ {
                                      global_precision_dmg_type
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmg2=@ {
                                      global_critical_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmg2_type=@ {
                                      global_critical_dmg_type
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    dual_precision_dmg=@ {
                                      precision_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    dual_precision_dmg_type=@ {
                                      precision_dmg_type
                                    }
                                    
                                  }
                                  
                                }
                                 @ {
                                  iterative_attacks
                                }
                                 @ {
                                  macro_options
                                }
                                  {
                                   {
                                    attack1name=@ {
                                      iterative_attack1_name
                                    }
                                    
                                  }
                                  
                                }
                                ",Va.size(p)&&(c+=u=" "+p.join(" ")),t[g+"macro-text"]=c,t[g+"NPC-macro-text"]=c,t[g+"attack"]=e.mainhand_penalty,t[g+"attack-mod"]=e.mainhand_penalty,t[g+"total-attack"]=e.mainhand_penalty,s=Math.floor(e.bab/5)+1+e.offhand_improved,i=2,f=d;i<=s;)b="",0===m||i%2==1?(d-=5,b=o.replace(/REPLACEHAND/g,e.mainhand_id),l=d+e.mainhand_penalty,t[g+"iterative_attack"+i+"_name"]=e.mainhand_name+" [[ @ {
                                  repeating_weapon_"+e.mainhand_id+"_total-attack
                                }
                                 - "+Math.abs(d)+" - "+Math.abs(e.mainhand_penalty)+" ]]"):(b=" {
                                   {
                                    attackREPLACEITER=[[ 1d20cs>[[ @ {
                                      repeating_weapon_REPLACEHAND_crit-target
                                    }
                                     ]] + [[ @ {
                                      repeating_weapon_REPLACEHAND_attack_macro
                                    }
                                     ]] + @ {
                                      iterative_attackREPLACEITER_value
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    damageREPLACEITER=[[ @ {
                                      repeating_weapon_REPLACEHAND_damage-dice-num
                                    }
                                    d@ {
                                      repeating_weapon_REPLACEHAND_damage-die
                                    }
                                     + @ {
                                      repeating_weapon_REPLACEHAND_damage_macro
                                    }
                                     REPLACEMULT ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    typeREPLACEITER=@ {
                                      typeREPLACEITER
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    crit_confirmREPLACEITER=[[ 1d20 + [[ @ {
                                      repeating_weapon_REPLACEHAND_attack_macro
                                    }
                                     ]] + @ {
                                      iterative_attackREPLACEITER_value
                                    }
                                      + @ {
                                      repeating_weapon_REPLACEHAND_crit_conf_mod
                                    }
                                     ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    crit_damageREPLACEITER=[[ [[ @ {
                                      repeating_weapon_REPLACEHAND_damage-dice-num
                                    }
                                     * [[ @ {
                                      repeating_weapon_REPLACEHAND_crit-multiplier
                                    }
                                     - 1 ]] ]]d@ {
                                      repeating_weapon_REPLACEHAND_damage-die
                                    }
                                     + ((@ {
                                      repeating_weapon_REPLACEHAND_damage_macro
                                    }
                                     REPLACEMULT ) * [[ @ {
                                      repeating_weapon_REPLACEHAND_crit-multiplier
                                    }
                                     - 1 ]]) ]]
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmgREPLACEITER1=@ {
                                      repeating_weapon_REPLACEHAND_precision_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmgREPLACEITER1=@ {
                                      repeating_weapon_REPLACEHAND_critical_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    precision_dmgREPLACEITER2=@ {
                                      global_precision_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    critical_dmgREPLACEITER2=@ {
                                      global_critical_dmg_macro
                                    }
                                    
                                  }
                                  
                                }
                                  {
                                   {
                                    attackREPLACEITERname=@ {
                                      iterative_attackREPLACEITER_name
                                    }
                                    
                                  }
                                  
                                }
                                 ".replace(/REPLACEHAND/g,e.offhand_id),.5===e.offhand_mult?(h="- [[ ceil(@ {
                                  repeating_weapon_REPLACEHAND_damage-ability-mod
                                }
                                /2) ]] ".replace(/REPLACEHAND/g,e.offhand_id),b=b.replace(/REPLACEMULT/g,h)):b=b.replace(/REPLACEMULT/g,""),l=_+e.offhand_penalty,t[g+"iterative_attack"+i+"_name"]=e.offhand_name+" [[@ {
                                  repeating_weapon_"+e.offhand_id+"_total-attack
                                }
                                 - "+Math.abs(_)+" - "+Math.abs(e.offhand_penalty)+"]]",_-=5,m--),b=b.replace(/REPLACEITER/g,i),t[g+"iterative_attack"+i+"_value"]=l,t[g+"var_iterative_attack"+i+"_macro"]=b,t[g+"toggle_iterative_attack"+i]="@ {
                                  var_iterative_attack"+i+"_macro
                                }
                                ",i++;i<=8&&(b=(b=o.replace(/REPLACEHAND/g,e.mainhand_id)).replace(/REPLACEITER/g,i),l=f+e.mainhand_penalty,t[g+"iterative_attack"+i+"_name"]="Extra full BAB MH attack",t[g+"iterative_attack"+i+"_value"]=l,t[g+"var_iterative_attack"+i+"_macro"]=b)}catch(e){n().error("PFAttacks.setDualWieldVals outererr",e)}finally{return t}}function yo(e,t){var a=Va.once((function(){"function"==typeof e&&e()})),n=Va.once((function(){t?Ja({update_twoweapon_attack:0},o.silentParams,a):a()}));getAttrs(["update_twoweapon_attack","mainhand_penalty","offhand_penalty","offhand_improved","bab","offhand_str_mult"],(function(e){!t||parseInt(e.update_twoweapon_attack,10)?getSectionIDs("repeating_weapon",(function(t){var a,r,i,s,c,l;t&&0!==Va.size(t)?(r=parseInt(e.mainhand_penalty,10)||0,i=parseInt(e.offhand_penalty,10)||0,s=parseInt(e.offhand_improved,10)||0,c=parseInt(e.bab,10)||0,l=parseFloat(e.offhand_str_mult)||.5,a=bn(["repeating_weapon_"],t,["_source-main","_source-off","_link_type","_source-main-name","_source-off-name","_macro-text","_NPC-macro-text"]),getAttrs(a,(function(e){var a={};t&&Va.size(t)&&t.forEach((function(t){var n="repeating_weapon_"+t+"_",o=parseInt(e[n+"link_type"],10),u={};try{o===io.weapon&&(u.mainhand_id=e[n+"source-main"],u.offhand_id=e[n+"source-off"],u.mainhand_penalty=r,u.offhand_penalty=i,u.offhand_improved=s,u.bab=c,u.mainhand_name=e[n+"source-main-name"],u.offhand_name=e[n+"source-off-name"],u.offhand_mult=l,u["macro-text"]=e[n+"macro-text"],u["NPC-macro-text"]=e[n+"NPC-macro-text"],ho(u,a,t,!0))}catch(e){}})),Va.size(a)?Ja(a,o.silentParams,n):n()}))):n()})):a()}))}function vo(e){var t={},a={};try{n().debug("at createDualWield:",e),t.mainhand_id=e.mainhand_id,t.offhand_id=e.offhand_id,t.mainhand_penalty=parseInt(e.mainhand_penalty,10)||0,t.offhand_penalty=parseInt(e.offhand_penalty,10)||0,t.offhand_improved=parseInt(e.offhand_improved,10)||0,t.bab=parseInt(e.bab,10)||0,t.mainhand_name=e.mainhand_name,t.offhand_name=e.offhand_name,t.offhand_mult=parseFloat(e.offhand_str_mult)||.5,a=ho(t,a)}catch(e){n().error("PFAttacks.createDualWield outererr",e)}finally{return a}}function ko(e,t){var a,r=function(){"function"==typeof t&&t()};e&&0!==Va.size(e)?(Va.after(Va.size(e),r),a=(a=(a=bn(["repeating_weapon_"],e,ao)).concat(bn(["repeating_weapon_"],e,no))).concat(ro),getAttrs(a,(function(t){var a,i,s;t=Va.mapObject(t,(function(e,t){return/attack\-type$/i.test(t)||/damage\-ability$/i.test(t)||/damage\-ability\-max$/i.test(t)||/damage_ability_mult$/i.test(t)?e:parseInt(e,10)||0})),s=parseInt(t.size,10)||0,i=parseInt(t.modify_dmg_by_size,10)||0,a=Va.reduce(e,(function(e,a){var r={},c=0;try{i&&t["repeating_weapon_"+a+"_size_affects"]&&(c=1),"dual"!==t["repeating_weapon_"+a+"_attack-type"]&&(r=function(e,t,a){var r,i="repeating_weapon_"+e+"_",s=t[i+"isranged"]||0,c=t[i+"enhance"]||0,o=t[i+"masterwork"]||0,l=t[i+"attack-type-mod"]||0,u=t[i+"proficiency"]||0,p=t[i+"attack-mod"]||0,d=t[i+"total-attack"],f=t[i+"damage-ability-mod"]||0,m=1,_=t[i+"total-damage"],g=t[i+"damage-mod"]||0,b=t[i+"damage-ability-max"],h=(t[i+"crit_conf_mod"],t[i+"crit_confirm"]||0),y=(t[i+"crit_confirm_temp"],t["buff_crit_conf-total"]||0),v=t[i+"attack-type"],k=t["buff_DMG-total"]||0,w=t["buff_dmg_power_attack-total"]||0,A="",C="",I=0,x=0,P=0,S=0,T=0;try{r=a||{},v&&"dual"!==v&&"0"!==v?/range/i.test(v)?s||(s=1,r[i+"isranged"]=1):s&&(r[i+"isranged"]=0):s&&(r[i+"isranged"]=0,s=0,w=0),m=so(t[i+"damage_ability_mult"]),s?(k+=t["buff_dmg_ranged-total"]||0,w=0,v.indexOf("2")>=0&&(k+=t["buff_dmg_ranged2-total"]||0,w=0)):(k+=t["buff_dmg_melee-total"]||0,v.indexOf("2")>=0&&(k+=t["buff_dmg_melee2-total"]||0)),k-=t["condition-Sickened"]||0,((T=Math.max(c,o)+l+u+p)!==d||isNaN(d))&&(r[i+"total-attack"]=T),b=parseInt(b,10),s&&!isNaN(b)||(b=999),f<=0&&(m=1,n().debug("~~~~~~ Multiplier only applies to an Ability bonus. Current Ability-Mod: "+f)),S=(P=Math.min(Math.floor(m*(f+w)),b))+k+g+c,n().debug("###########################","getRecalculatedAttack attackType:"+v+", ability:"+t["repeating_weapon_"+e+"_damage-ability"]+" mod:"+t["repeating_weapon_"+e+"_damage-ability-mod"]+", isranged:"+s+", damageBuffs:"+k+", maxability:"+b+", abilityMult:"+m+", abilitydmg:"+f+", ability dmg tot:"+P+", new total:"+S+", old total:"+_,"###########################"),(S!==_||isNaN(_))&&(r[i+"total-damage"]=S),v&&"dual"!==v&&"0"!==v&&(A=v.replace("attk-",""))&&(I=(C=vr[A].crit)?t[C]:0,t[i+"attack-type_macro_insert"]!==vr[A].attackmacro&&(r[i+"attack-type_macro_insert"]=vr[A].attackmacro),t[i+"damage-type_macro_insert"]!==vr[A].damagemacro&&(r[i+"damage-type_macro_insert"]=vr[A].damagemacro)),po(e,t,r),x=h+I+y,r[i+"crit_conf_mod"]=x,A||("0"!==t[i+"attack-type_macro_insert"]&&(r[i+"attack-type_macro_insert"]="0"),"0"!==t[i+"damage-type_macro_insert"]&&(r[i+"damage-type_macro_insert"]="0"))}catch(t){n().error("PFAttacks.getRecalculatedAttack for id "+e,t)}finally{return r}}(a,t),function(e,t,a,n,r){var i="repeating_weapon_"+gn(e);r?go(e,t,a,n,i):_o(e,a,n,r,i)}(a,s,t,r,c),Va.extend(e,r))}catch(e){n().error("PFAttacks.recalcOtherFields erri",e)}finally{return e}}),{}),Va.size(a)?Ja(a,{},r):r()}))):r()}function wo(e,t){var a,r=Va.once((function(){"function"==typeof t&&t()})),i=Va.after(Va.size(e),r);a=Va.chain(e).map((function(e){var t="repeating_weapon_"+e+"_";return[t+"damage",t+"attack",t+"crit_confirm",t+"damage-mod",t+"attack-mod",t+"crit_confirm_temp"]})).flatten().value(),getAttrs(a,(function(t){try{Va.each(e,(function(e){var a=Va.after(4,i),n="repeating_weapon_"+e+"_";t[n+"damage"]&&"0"!==t[n+"damage"]&&"+0"!==t[n+"damage"]||0!==parseInt(t[n+"damage-mod"],10)?an(n+"damage",n+"damage-mod",0,a,!0):a(),t[n+"attack"]&&"0"!==t[n+"attack"]&&"+0"!==t[n+"attack"]||0!==parseInt(t[n+"attack-mod"],10)?an(n+"attack",n+"attack-mod",0,a,!0):a(),t[n+"crit_confirm"]&&"0"!==t[n+"crit_confirm"]&&"+0"!==t[n+"crit_confirm"]||0!==parseInt(t[n+"crit_confirm_temp"],10)?an(n+"crit_confirm",n+"crit_confirm_temp",0,a,!0):a(),un(n+"attack-type",n+"attack-type-mod",null,a,!0),un(n+"damage-ability",n+"damage-ability-mod",null,a,!0)}))}catch(e){n().error("recalcEquationFields",e),r()}}))}function Ao(e){getSectionIDs("repeating_weapon",(function(e){e&&0!==Va.size(e)&&Va.each(e,(function(e){!function(e){var t="repeating_weapon_"+e+"_";un(t+"attack-type",t+"attack-type-mod",null,(function(){oo(e)}),!0)}(e)}))}))}function Co(e,t){wo([e],(function(){ko([e],t)}))}function Io(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=function(){yo(e)};getSectionIDs("repeating_weapon",(function(e){e&&0!==Va.size(e)?wo(e,(function(){ko(e,a)})):t()}))}function xo(e,t,a){var n=Va.once((function(){"function"==typeof e&&e()})),r="",i="";switch(t){case io.ability:r="source-ability";break;case io.equipment:r="source-item";break;case io.spell:r="source-spell";break;case io.weapon:r="source-main",i="source-off";break;default:return void n()}getSectionIDs("repeating_weapon",(function(e){var t,s;e&&0!==Va.size(e)?(s=["_"+r,"_"+r+"-name"],i&&(s.push("_"+i),s.push("_"+i+"-name"),s.push("_name")),t=bn(["repeating_weapon"],e,s),getAttrs(t,(function(t){var s={};e.forEach((function(e){var n="repeating_weapon_"+e+"_";t[n+r]===a&&(s[n+"link_type"]=0,s[n+r]="",s[n+r+"-name"]="",i&&(s[n+i]="",s[n+i+"-name"]="",s[n+"name"]="UNLINKED "+t[n+"name"]))})),Va.size(s)?Ja(s,o.silentParams,n):n()}))):n()}))}function Po(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=Va.once((function(){Ja({migrated_attacklist_defaults111:1},o.silentParams,t)}));getAttrs(["migrated_attacklist_defaults111"],(function(e){parseInt(e.migrated_attacklist_defaults111,10)||0?t():getSectionIDs("repeating_weapon",(function(e){var r;e||Va.size(e)?((r=bn(["repeating_weapon_"],e,["_damage-dice-num","_damage-die"])).push("size"),getAttrs(r,(function(r){var i={};try{i=function(e,t,a){var r,i;try{a=a||{},i=parseInt(t.size,10)||0,r=Va.reduce(e,(function(e,a){var r="repeating_weapon_"+a+"_";try{e[r+"default_size"]=i,t[r+"damage-dice-num"]?e[r+"default_damage-dice-num"]=t[r+"damage-dice-num"]:(e[r+"default_damage-dice-num"]=0,e[r+"damage-dice-num"]=0),t[r+"damage-die"]?e[r+"default_damage-die"]=t[r+"damage-die"]:(e[r+"default_damage-die"]=0,e[r+"damage-die"]=0)}catch(e){n().error("PFAttacks.setNewDefaultsSync errin id "+a,e)}finally{return e}}),{}),Va.extend(a,r)}catch(e){n().error("PFAttacks.getNewDefaults errout ",e)}finally{return a}}(e,r,i)}catch(e){n().error("PFAttacks.setNewDefaults errout ",e)}finally{Va.size(i)?Ja(i,o.silentParams,a):t()}}))):a()}))}))}function So(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));t<=0&&t>=1.5?a():getSectionIDs("repeating_weapon",(function(e){var t;e&&0!==Va.size(e)?((t=bn(["repeating_weapon_"],e,["_source-item","_source-spell","_source-ability","_source-main","_source-off","_source-spell-name","_source-ability-name"])).push("migrated_linked_attacks"),getAttrs(t,(function(t){var n={};parseInt(t.migrated_linked_attacks,10)?a():(e.forEach((function(e){var a=0;t["repeating_weapon_"+e+"_source-item"]?a=io.equipment:t["repeating_weapon_"+e+"_source-spell"]?a=io.spell:t["repeating_weapon_"+e+"_source-ability"]?(a=io.ability,t["repeating_weapon_"+e+"_source-spell-name"]&&!t["repeating_weapon_"+e+"_source-ability-name"]&&(n["repeating_weapon_"+e+"_source-ability-name"]=t["repeating_weapon_"+e+"_source-spell-name"],n["repeating_weapon_"+e+"_source-spell-name"]="")):(t["repeating_weapon_"+e+"_source-main"]||t["repeating_weapon_"+e+"_source-off"])&&(a=io.weapon),n["repeating_weapon_"+e+"_link_type"]=a})),n.migrated_linked_attacks=1,Va.size(n)?Ja(n,o.silentParams,a):a())}))):a()}))}function To(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["migrated_damage-multiplier"],(function(e){var t,r;t=parseInt(e["migrated_damage-multiplier"],10)||0,r=parseInt(e.migrated_attacklist_defaults111),t&&r?a():getSectionIDs("repeating_weapon",(function(e){var r,i;try{if(!e||Va.size(e)<=0)return void Ja({"migrated_damage-multiplier":1,migrated_attacklist_defaults111:1},o.silentParams,a);i=function(){Po((function(){So(a)}))},r=function(){t?i():function(e,t){var a=Va.once((function(){"function"==typeof t&&t()})),r=[];Va.each(e,(function(e){var t="repeating_weapon_"+e+"_damage-ability",a="repeating_weapon_"+e+"_damage_ability_mult";r.push(t),r.push(a)})),r.push("migrated_damage-multiplier"),getAttrs(r,(function(t){var r={};try{parseInt(t["migrated_damage-multiplier"],10)||(Va.each(e,(function(e){var a,i,s,c,o,l="repeating_weapon_"+e+"_damage-ability",u="repeating_weapon_"+e+"_damage_ability_mult";try{a=vn(t[l]),i=(o=t[l])?o.indexOf("1.5")>=0?1.5:o.indexOf(".5")>=0||o.indexOf("1/2")>=0?.5:o.indexOf("3/2")>=0||o.indexOf("1 1/2")>=0?1.5:o.indexOf("2")>=0?2:1:0,s="@ {
                                  "+a+"
                                }
                                ",c=parseFloat(i,10),!t[u]&&i&&a&&(isNaN(c)||(r[u]=1!==c?i:1),a&&(r[l]=s))}catch(a){n().error("migrateRepeatingDamage dropdown to mult: could not migrate str "+t[l]+" in attack row "+e,a)}})),r["migrated_damage-multiplier"]="1")}catch(e){n().error("migrateRepeatingDamage outer error!? SHOULD NOT HAPPEN",e)}finally{Va.size(r)>0?Ja(r,o.silentParams,a):a()}}))}(e,i)},r()}catch(e){n().error("PFAttacks.migrate",e),a()}}))}))}var Eo=n().callback((function(e,t,a){Mr((function(){To((function(){getAttrs(["adv_macro_show","global_melee_macro_insert","global_ranged_macro_insert","global_cmb_macro_insert","global_attack_macro_insert","global_melee_damage_macro_insert","global_ranged_damage_macro_insert","global_cmb_damage_macro_insert","global_damage_macro_insert"],(function(e){var t=parseInt(e.adv_macro_show,10)||0;Va.reduce(e,(function(e,t,a){return"adv_macro_show"!==a&&""!==t&&"0"!==t&&null!=t&&(e+=1),e}),0)&&!t&&Ja({adv_macro_show:1},o.silentParams)})),Io(),Tr(),br(),function(e){var t=Va.once((function(){"function"==typeof e&&e()}));getSectionIDs("repeating_weapon",(function(e){var a,r=[];0!==Va.size(e)?(a=Va.after(Va.size(e),(function(){t()})),r=Va.map(e,(function(e){return["repeating_weapon_"+e+"_source-item","repeating_weapon_"+e+"_source-spell","repeating_weapon_"+e+"_source-ability"]})),r=Va.flatten(r),getAttrs(r,(function(t){e=Va.map(e,(function(e){return e.toLowerCase()})),getSectionIDs("repeating_spells",(function(r){r=Va.map(r,(function(e){return e.toLowerCase()})),getSectionIDs("repeating_item",(function(i){i=Va.map(i,(function(e){return e.toLowerCase()})),getSectionIDs("repeating_ability",(function(s){var c={};s=Va.map(s,(function(e){return e.toLowerCase()})),n().debug("################","Checking linked attacks. attack links, spellids, itemids, abilityids",t,r,i,s),Va.each(e,(function(e){t["repeating_weapon_"+e+"_source-item"]?(n().debug("checking "+e+" for item:"+t["repeating_weapon_"+e+"_source-item"]),"DELETED"!==t["repeating_weapon_"+e+"_source-item"]&&(n().debug("looking for "+t["repeating_weapon_"+e+"_source-item"]+" in item list"),Va.size(i>0)&&Va.contains(i,t["repeating_weapon_"+e+"_source-item"])?fs(t["repeating_weapon_"+e+"_source-item"],a,!0,null,e):n().warn("weapon "+e+" item link is not found:"+t["repeating_weapon_"+e+"_source-item"]))):t["repeating_weapon_"+e+"_source-spell"]?(n().debug("checking "+e+" for spell:"+t["repeating_weapon_"+e+"_source-spell"]),"DELETED"!==t["repeating_weapon_"+e+"_source-spell"]&&(n().debug("looking for "+t["repeating_weapon_"+e+"_source-spell"]+" in spell list"),Va.size(r>0)&&Va.contains(r,t["repeating_weapon_"+e+"_source-spell"])?qs(t["repeating_weapon_"+e+"_source-spell"],a,!0,null,e):n().warn("weapon "+e+" spell link is not found:"+t["repeating_weapon_"+e+"_source-spell"]))):t["repeating_weapon_"+e+"_source-ability"]?(n().debug("checking "+e+" for ability:"+t["repeating_weapon_"+e+"_source-ability"]),"DELETED"!==t["repeating_weapon_"+e+"_source-ability"]&&(n().debug("looking for "+t["repeating_weapon_"+e+"_source-ability"]+" in ability list"),Va.size(s>0)&&Va.contains(s,t["repeating_weapon_"+e+"_source-ability"])?kc(t["repeating_weapon_"+e+"_source-ability"],a,!0,null,e):n().warn("weapon "+e+" ability link is not found:"+t["repeating_weapon_"+e+"_source-ability"]))):(n().debug("nothing linked to "+e),a())})),Va.size(c)>0&&Ja(c,o.silentParams)}))}))}))}))):t()}))}(),bo(),n().info("leaving PFAttacks.recalculate"),"function"==typeof e&&e()}))}),t,a)}));on("change:repeating_weapon:attack-type",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(Un("weapon",null,"attack-type","attack-type-mod",(function(e,t,a){a&&co(0,e,t)}),!0),function(e){var t=gn(e);getAttrs(["attk_ranged_crit_conf","attk_ranged2_crit_conf","attk_melee_crit_conf","attk_melee2_crit_conf","attk_cmb_crit_conf","attk_cmb2_crit_conf","buff_crit_conf-total","repeating_weapon_"+t+"crit_conf_mod","repeating_weapon_"+t+"crit_confirm","repeating_weapon_"+t+"attack-type","repeating_weapon_"+t+"crit_confirm_temp"],(function(t){var a={};try{t=Va.mapObject(t,(function(e,t){return/attack\-type$/i.test(t)||/damage\-ability$/i.test(t)||/damage\-ability\-max$/i.test(t)||/damage_ability_mult$/i.test(t)?e:parseInt(e,10)||0})),po(e,t,a)}catch(t){n().error("updateRepeatingWeaponCritAsync: error updating crit for id  "+e,t)}finally{Va.size(a)&&Ja(a,o.silentParams)}}))}(null),function(e){var t=function(){},a="repeating_weapon_"+gn(e),n=a+"attack-type";getAttrs([n],(function(e){var r=vn(e[n]),i={};r?(r=r.replace("attk-",""),i[a+"attack-type_macro_insert"]=vr[r].attackmacro,i[a+"damage-type_macro_insert"]=vr[r].damagemacro):i[a+"attack-type_macro_insert"]="0",Ja(i,o.silentParams,t)}))}(null),function(e){var t="repeating_weapon_"+gn(e),a=t+"attack-type",n=t+"isranged";getAttrs([a,n],(function(e){var t={},r=0;/ranged/i.test(e[a])&&(r=1),(parseInt(e[n],10)||0)!==r&&(t[n]=r,Ja(t,o.silentParams))}))}(),uo(null,e))}))),on("change:repeating_weapon:attack",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),an("repeating_weapon_attack","repeating_weapon_attack-mod",0,(function(e,t,a){a&&co(0,e,t)}),!0)}))),on("change:repeating_weapon:attack-type-mod change:repeating_weapon:attack-mod",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),oo(null))}))),on("change:repeating_weapon:masterwork change:repeating_weapon:proficiency",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),oo(null))}))),on("change:repeating_weapon:damage-ability",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType&&"sheetworker"!==e.sourceType||Un("weapon",null,"damage-ability","damage-ability-mod")}))),on("change:repeating_weapon:damage",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),an("repeating_weapon_damage","repeating_weapon_damage-mod",0,(function(e,t,a){a&&lo(id,e,t)}),!0)}))),on("change:repeating_weapon:crit_confirm",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),an("repeating_weapon_crit_confirm","repeating_weapon_crit_confirm_temp",0,(function(e,t,a){a&&function(e,t,a,n){var r=(t||0)-(a||0);getAttrs(["repeating_weapon_crit_conf_mod"],(function(e){var t=parseInt(e.repeating_weapon_crit_conf_mod,10)||0;setAttrs({repeating_weapon_crit_conf_mod:t+=r},o.silentParams,n)}))}(0,e,t)}),!0)}))),on("change:repeating_weapon:damage_ability_mult",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),uo(null,e))}))),on("change:repeating_weapon:damage-ability-max",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),uo(null,e))}))),on("change:repeating_weapon:damage-ability-mod change:repeating_weapon:damage-mod",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),uo(null,e))}))),on("change:repeating_weapon:enhance",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(oo(null),uo(null,e))}))),Va.each(vr,(function(e,t){on("change:"+e.crit,n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),fo(t))}))),on("change:"+e.critconfirm,n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),fo("melee"))}))),on("change:"+e.atk,n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),n().debug("Yeah baby!"),Ao(e.sourceAttribute))})))})),on("change:repeating_weapon:default_damage-dice-num change:repeating_weapon:default_size change:repeating_weapon:default_damage-die change:repeating_weapon:size_affects",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),function(e){var t="repeating_weapon_"+gn(e);getAttrs(["modify_dmg_by_size","size","default_char_size",t+"default_size",t+"size_affects",t+"default_damage-dice-num",t+"default_damage-die",t+"not_default_size",t+"damage-dice-num",t+"damage-die"],(function(a){var n={},r=0;try{parseInt(a.modify_dmg_by_size,10)&&(r=parseInt(a.size,10)||0,go(e,r,a,n,t))}finally{Va.size(n)&&Ja(n)}}))}())}))),on("change:repeating_weapon:damage-dice-num change:repeating_weapon:damage-die",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),function(e){var t="repeating_weapon_"+gn(e);getAttrs(["modify_dmg_by_size",t+"size_affects",t+"damage-dice-num",t+"damage-die"],(function(a){var n={},r=0;(parseInt(a.modify_dmg_by_size,10)||parseInt(a[t+"size_affects"],10))&&(r=1),_o(e,a,n,r,t),Va.size(n)&&Ja(n,o.silentParams)}))}())}))),on("remove:repeating_weapon change:repeating_weapon:attack-type change:_reporder_repeating_weapon change:repeating_weapon:group change:repeating_weapon:name change:include_attack_totals",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Tr())}))),on("remove:repeating_weapon",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),xo(null,io.weapon,mn(e.sourceAttribute)))}))),on("change:create_twoweapon_attack",n().callback((function(e){var t,a,r;"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),a=Va.once((function(){"function"==typeof t&&t()})),r=function(e){e&&Va.size(e)?(e.create_twoweapon_attack=0,e.mainhand_id="",e.offhand_id="",Ja(e,o.silentParams,(function(){Tr(),a()}))):Ja({create_twoweapon_attack:0},o.silentParams,a)},getAttrs(["create_twoweapon_attack","mainhand_id","mainhand_penalty","offhand_id","offhand_penalty","offhand_improved","bab","offhand_str_mult"],(function(e){try{1===parseInt(e.create_twoweapon_attack,10)&&getSectionIDs("repeating_weapon",(function(t){var a=[],i={};try{if(!t||0===Va.size(t))return void r();Va.contains(t,e.mainhand_id)&&Va.contains(t,e.offhand_id)?getAttrs(["repeating_weapon_"+e.mainhand_id+"_name","repeating_weapon_"+e.offhand_id+"_name"],(function(t){e.mainhand_name=t["repeating_weapon_"+e.mainhand_id+"_name"],e.offhand_name=t["repeating_weapon_"+e.offhand_id+"_name"],n().debug("they are there! calling with ",e,t),i=vo(e),r(i)})):(a=t.map((function(e){return"repeating_weapon_"+e+"_name"})),getAttrs(a,(function(t){var a="",s="";Va.each(t,(function(t,r){n().debug("comparing "+e.mainhand_id+" to "+t+" of row "+r),t===e.mainhand_id?(a=mn(r),e.mainhand_name=t,e.mainhand_id=a):t===e.offhand_id&&(s=mn(r),e.offhand_name=t,e.offhand_id=s)})),a&&s&&(n().debug("calling createDualWield with :",e),i=vo(e)),r(i)})))}catch(e){n().error("PFAttacks.createDualWieldAsync ierr",e),r()}}))}catch(e){n().error("PFAttack.createDualWieldAsync outererror",e),r()}})))}))),on("change:update_twoweapon_attack",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),yo(null,e))})));var Do=["STR","DEX","CON","INT","WIS","CHA"],Mo=["STR-mod","DEX-mod","CON-mod","INT-mod","WIS-mod","CHA-mod"],Fo=["-base","-racial","-asi","-enhance","-inherent","-misc","-damage","-penalty","-drain","-mod","-cond","-modded"],No=["-total","-total_penalty"],Ro=["condition-Helpless","condition-Paralyzed"],zo={abilityEventsAuto:"change:REPLACE-cond",abilityEventsPlayer:"change:REPLACE-base change:REPLACE-racial change:REPLACE-asi change:REPLACE-enhance change:REPLACE-inherent change:REPLACE-misc change:REPLACE-temp change:REPLACE-damage change:REPLACE-penalty change:REPLACE-drain"};function Lo(e){var t=parseInt(e,10);return isNaN(t)?o.minusreg.test(e)?{base:"-",mod:0}:{base:10,mod:0}:{base:t,mod:Math.floor((t-10)/2)}}function Oo(e,t,a,n){var r,i,s=Va.once((function(){"function"==typeof e&&e()}));Array.isArray(a)?r=a:a?(a=a.slice(0,3).toUpperCase()+"-mod",r=[a]):r=Mo,getSectionIDs("repeating_weapon",(function(e){Va.each(e,(function(e){Un("weapon",e,"damage-ability","damage-ability-mod",(function(t,a,n){n&&lo(e,t,a)}),!0)}))})),i=(i=(i=r).concat(Object.keys(o.abilityScoreManualDropdowns))).concat(Va.values(o.abilityScoreManualDropdowns)),getAttrs(i,(function(e){var n,i=0,c={};n=r.reduce((function(t,n){var r;return i=i||parseInt(e[a],10)||0,r=function(e,t,a,n){return n=n||{},Object.keys(o.abilityScoreManualDropdowns).filter((function(t){return a[t]===e})).reduce((function(e,n){var r=parseInt(a[o.abilityScoreManualDropdowns[n]],10)||0;return t!==r&&(e[o.abilityScoreManualDropdowns[n]]=t),e}),n)}(a,i,e),Va.extend(t,r),t}),{}),Va.size(n)?(t&&(c=o.silentParams),setAttrs(n,c,s)):s()}))}function qo(e,t,a,n){var r;return n=n||{},e=e.toUpperCase(),r=parseInt(a[e+"-base"],10)||10,r+=t,r=Math.max(r,1),n[e+"-base"]=r,r=parseInt(a[e],10)||10,r+=t,r=Math.max(r,1),n[e]=r,r=parseInt(a[e+"-mod"],10)||0,r+=Math.floor(t/2),r=Math.max(r,1),n[e+"-mod"]=r,n}function Ho(e,t,a){var r=0,i=0,s=0,c=0,l=0,u=0,p=0,d=0,f=0,m=0,_=0,g=0;try{if(a=a||{},r=parseInt(t[e+"-base"],10),isNaN(r)&&!o.minusreg.test(t[e+"-base"]))return a;m=parseInt(t[e+"-mod"],10),_=parseInt(t[e+"-modded"],10)||0,f=parseInt(t[e],10),isNaN(r)?(i="-",g=0,p=0):(u=parseInt(t["condition-Helpless"],10)||0,l=parseInt(t["condition-Paralyzed"],10)||0,"DEX"===e&&(u||l)||"STR"===e&&l?(i=0,g=-5,p=1):(i=r+(parseInt(t[e+"-enhance"],10)||0)+(parseInt(t[e+"-racial"],10)||0)+(parseInt(t[e+"-asi"],10)||0)+(parseInt(t[e+"-inherent"],10)||0)+(parseInt(t[e+"-misc"],10)||0)+(parseInt(t[e+"-drain"],10)||0)+(parseInt(t["buff_"+e+"-total"],10)||0),(s=Math.abs(parseInt(t[e+"-damage"],10)||0))>=i||i<=0?(i=0,g=-5,p=1):(d=s+(Math.abs(parseInt(t[e+"-penalty"],10)||0)+Math.abs(parseInt(t["buff_"+e+"-total_penalty"],10)||0))+Math.abs(parseInt(t[e+"-cond"],10)||0))>=i?(i=f,g=-5,p=1):(0!==d&&(p=1),c=Math.floor(d/2),g=Math.max(-5,Math.floor((i-10)/2)-c)))),f!==i&&(a[e]=i),(m!==g||isNaN(m))&&(a[e+"-mod"]=g),p!==_&&(a[e+"-modded"]=p)}catch(t){n().error("updateAbilityScore:"+e,t)}finally{return a}}function Bo(e,t,a,n){var r=Va.once((function(){"function"==typeof a&&a()})),i=function(e){var t=Va.map(Fo,(function(t){return e+t}));return t.push(e),(t=t.concat(Va.map(No,(function(t){return"buff_"+e+t})))).concat(Ro)}(e);getAttrs(i,(function(t){var a={},i={};Ho(e,t,i),Va.size(i)?(n&&(a=o.silentParams),Ja(i,a,r)):r()}))}function Uo(e,t){var a=Va.once((function(){"function"==typeof e&&e()})),n=function(){var e=bn(Do,Fo);return(e=(e=e.concat(Do)).concat(bn(["buff_"],Do,No))).concat(Ro)}();getAttrs(n,(function(e){var n,r={};n=Va.reduce(Do,(function(t,a){return Ho(a,e,t),t}),{}),Va.size(n)?(t&&(r=o.silentParams),Ja(n,r,a)):a()}))}function jo(e,t,a){getAttrs(["STR-cond","DEX-cond","condition-Helpless","condition-Paralyzed","condition-Exhausted","condition-Fatigued","condition-Entangled","condition-Grappled"],(function(a){var r={},i={},s=0,c=0,l=0,u=0,p=0;try{l=parseInt(a.helpless,10)||0,parseInt(a.paralyzed,10)||0?(i.DEX=0,i["DEX-modded"]=1,r["DEX-mod"]=-5,i.STR=0,i["STR-modded"]=1,r["STR-mod"]=-5):l?(i.DEX=0,i["DEX-modded"]=1,r["DEX-mod"]=-5):(c=(s=(parseInt(a["condition-Fatigued"],10)||0)+(parseInt(a["condition-Exhausted"],10)||0))+(parseInt(a["condition-Entangled"],10)||0)+(parseInt(a["condition-Grappled"],10)||0),p=-2*s,(u=-2*c)!==(parseInt(a["DEX-cond"],10)||0)&&(r["DEX-cond"]=u),p!==(parseInt(a["STR-cond"],10)||0)&&(r["STR-cond"]=p))}catch(e){n().error("PFAbilityScores.applyConditions",e)}finally{t?(Va.extend(i,r),Va.size(i)?setAttrs(i,o.silentParams,e):"function"==typeof e&&e()):Va.size(r)?(Va.size(i)&&setAttrs(i,o.silentParams),setAttrs(r,{},e)):Va.size(i)?setAttrs(i,o.silentParams,e):"function"==typeof e&&e()}}))}var Wo=n().callback((function(e,t){"function"==typeof e&&e()})),Go=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFAbilityScores.recalculate"),"function"==typeof e&&e()})),i=Va.once((function(){Oo(r,t)})),s=Va.once((function(){Uo(i,t)}));Wo((function(){jo(s,t)}),a)}));Va.each(Do,(function(e){on(zo.abilityEventsAuto.replace(/REPLACE/g,e),n().callback((function(t){"sheetworker"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),Bo(e))}))),on(zo.abilityEventsPlayer.replace(/REPLACE/g,e),n().callback((function(t){"player"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),Bo(e))})))})),on("change:condition-Helpless",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Bo("DEX"))}))),Mo.forEach((function(e){on("change:"+e,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Oo(null,null,e.sourceAttribute)})))}));var Xo=["Fort","Ref","Will"],Vo={saveEventsAuto:"change:saves-cond change:total-REPLACE change:REPLACE-ability-mod change:REPLACE-misc-mod",saveEventsPlayer:"change:REPLACE-trait change:REPLACE-resist"};function $o(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["condition-Fear","condition-Sickened","condition-Drained","condition-Wounds","saves-cond","has_endurance_feat","wounds_gritty_mode","wound_threshold-show"],(function(e){var r=0,i=0,s=0,c=0,l=0,u={},p={};try{r=parseInt(e["condition-Fear"],10)||0,i=parseInt(e["condition-Sickened"],10)||0,s=parseInt(e["condition-Drained"],10)||0,c=(parseInt(e["wound_threshold-show"],10)||0)*An(parseInt(e["condition-Wounds"],10)||0,parseInt(e.has_endurance_feat,10)||0,parseInt(e.wounds_gritty_mode,10)||0),(parseInt(e["saves-cond"],10)||0)!==(l=s-r-i+c)&&(p["saves-cond"]=l)}catch(e){n().error("PFSaves.applyConditions",e)}finally{Va.size(p)>0?(t&&(u=o.silentParams),Ja(p,u,a)):a()}}))}function Ko(e,t,a){pn([e,"total-"+e,e+"-ability-mod",e+"-trait",e+"-resist",e+"-misc-mod","saves-cond","buff_"+e+"-total","buff_saves-total"],0,[],!1,t,a)}function Yo(e,t){var a=Va.once((function(){"function"==typeof e&&e()})),n=Va.after(3,(function(){a()}));Ko("Fort",n,t),Ko("Ref",n,t),Ko("Will",n,t)}var Zo=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFSaves.recalculate"),"function"==typeof e&&e()}));try{$o((function(){Yo(r,t)}),t)}catch(e){n().error("PFSaves.recalculate OUTER",e),r()}}));function Jo(e,t,a){getAttrs(["use_spells","spellclass-"+e+"-exists"],(function(r){try{parseInt(r.use_spells,10)&&parseInt(r["spellclass-"+e+"-exists"],10)?"function"==typeof t&&t():"function"==typeof a&&a()}catch(e){n().error("PFSpellCasterClasses.ifSpellClassExists",e),"function"==typeof a&&a()}}))}function Qo(e,t,a){var n=Va.once((function(){"function"==typeof a&&a()}));getAttrs(["spellclass-0-exists","spellclass-1-exists","spellclass-2-exists"],(function(e){var t=parseInt(e.spellclasses_multiclassed,10)||0,a={};(parseInt(e["spellclass-0-exists"],10)||0)+(parseInt(e["spellclass-1-exists"],10)||0)+(parseInt(e["spellclass-2-exists"],10)||0)>1?t||(a.spellclasses_multiclassed=1):t&&(a.spellclasses_multiclassed=0),Va.size(a)>0?Ja(a,o.silentParams,n):n()}))}function el(e,t){getAttrs(["spellclass-0-exists","spellclass-1-exists","spellclass-2-exists","spellclass-0-name","spellclass-1-name","spellclass-2-name","allspells_macro","NPC-allspells_macro"],(function(t){var a="",n="",r="";parseInt(t["spellclass-0-exists"],10)&&(a+=(r=" {
                                   {
                                    row10=["+fn(t["spellclass-0-name"])+" ^ {
                                      spellbook
                                    }
                                    ](~@ {
                                      character_id
                                    }
                                    |")+"spellbook-0) 
                                  }
                                  
                                }
                                 ",n+=r+"NPC-spellbook-0) 
                              }
                              
                            }
                             "),parseInt(t["spellclass-1-exists"],10)&&(a+=(r=" {
                               {
                                row11=["+fn(t["spellclass-1-name"])+" ^ {
                                  spellbook
                                }
                                ](~@ {
                                  character_id
                                }
                                |")+"spellbook-1) 
                              }
                              
                            }
                             ",n+=r+"NPC-spellbook-1) 
                          }
                          
                        }
                         "),parseInt(t["spellclass-2-exists"],10)&&(a+=(r=" {
                           {
                            row12=["+fn(t["spellclass-2-name"])+" ^ {
                              spellbook
                            }
                            ](~@ {
                              character_id
                            }
                            |")+"spellbook-2) 
                          }
                          
                        }
                         ",n+=r+"NPC-spellbook-2) 
                      }
                      
                    }
                     "),a!==t.allspells_macro?Ja({allspells_macro:a,"NPC-allspells_macro":n},o.silentParams,e):"function"==typeof e&&e()}))}function tl(e,t,a,r,i){var s=function(){"function"==typeof r&&r()},c="spellclass-"+e,l=c+"-level-total",u=c+"-close",p=c+"-medium",d=c+"-long";getAttrs(["use_metrics",l,u,p,d],(function(e){var t=parseInt(e.use_metrics)||0,r=parseInt(e[l],10)||0,c=parseInt(e[u],10)||0,f=parseInt(e[p],10)||0,m=parseInt(e[d],10)||0,_={},g={},b={};try{_=kn(r,t),(a||_.close!==c||_.medium!==f||_.long!==m)&&(g[u]=_.close,g[p]=_.medium,g[d]=_.long)}catch(e){n().error("PFSpellCasterClasses.updateCasterRanges",e)}finally{Va.size(g)>0?(i&&(b=o.silentParams),Ja(g,b,s)):s()}}))}function al(e,t,a,n){pn(["Concentration-"+e,"spellclass-"+e+"-level-total","Concentration-"+e+"-mod","Concentration-"+e+"-misc-mod"],0,null,!1,a,n)}function nl(e,t,a,r){var i=Va.once((function(){"function"==typeof a&&a()}));getAttrs(["use_spells","spellclass-"+e+"-exists","Concentration-"+e+"-ability","Concentration-"+e+"-mod","spellclass-"+e+"-level-0-savedc","spellclass-"+e+"-savedc-misc","buff_SpellDC_"+e+"-total"],(function(t){var a,s=parseInt(t["Concentration-"+e+"-mod"],10)||0,c=(parseInt(t["spellclass-"+e+"-savedc-misc"],10)||0)+(parseInt(t["buff_SpellDC_"+e+"-total"],10)||0),l=t["Concentration-"+e+"-ability"],u=10+s+c,p=parseInt(t["spellclass-"+e+"-level-0-savedc"],10)||0,d={},f={};try{if(p!==u||isNaN(p)||0!==l)for(d["spellclass-"+e+"-level-0-savedc"]=u,a=1;a<10;a++)d["spellclass-"+e+"-level-"+a+"-savedc"]=u+a}catch(e){n().error("PFSpellCasterClasses.updateSaveDCs",e)}finally{Va.size(d)>0?(r&&(f=o.silentParams),Ja(d,f,i)):i()}}))}function rl(e,t,a,r){var i=Va.once((function(){"function"==typeof a&&a()})),s="Concentration-"+e+"-ability";getAttrs([s,"INT","WIS","CHA","STR","DEX","CON","spellclass-"+e+"-level-0-bonus","spellclass-"+e+"-level-1-bonus","spellclass-"+e+"-level-2-bonus","spellclass-"+e+"-level-3-bonus","spellclass-"+e+"-level-4-bonus","spellclass-"+e+"-level-5-bonus","spellclass-"+e+"-level-6-bonus","spellclass-"+e+"-level-7-bonus","spellclass-"+e+"-level-8-bonus","spellclass-"+e+"-level-9-bonus"],(function(t){var a,r,c,o=vn(t[s]).replace("-mod",""),l=parseInt(t[o],10),u={},p="spellclass-"+e+"-level-";try{if(!isNaN(l))if(l>=12)for(c=1;c<10;c++)a=Math.floor(Math.max(Math.floor((l-10)/2)+4-c,0)/4),r=p+c+"-bonus",parseInt(t[r],10)!==a&&(u[r]=a);else for(c=1;c<10;c++)r=p+c+"-bonus",0!==parseInt(t[r],10)&&(u[r]=0)}catch(e){n().error("PFSpellCasterClasses.updateBonusSpells",e)}finally{Va.size(u)>0?Ja(u,{silent:!0},i):i()}}))}function il(e,t,a,r){var i=Va.once((function(){"function"==typeof a&&a()}));getAttrs(["spellclass-"+e+"-level-"+t+"-spells-per-day_max","spellclass-"+e+"-level-"+t+"-class","spellclass-"+e+"-level-"+t+"-bonus","spellclass-"+e+"-level-"+t+"-misc"],(function(a){var r=0,s=0,c=0,l={};try{s=parseInt(a["spellclass-"+e+"-level-"+t+"-class"],10),c=parseInt(a["spellclass-"+e+"-level-"+t+"-spells-per-day_max"],10)||0,(r=isNaN(s)?0:s+((parseInt(a["spellclass-"+e+"-level-"+t+"-bonus"],10)||0)+(parseInt(a["spellclass-"+e+"-level-"+t+"-misc"],10)||0)))!==c?(l["spellclass-"+e+"-level-"+t+"-spells-per-day_max"]=r,Ja(l,o.silentParams,i)):i()}catch(e){n().error("PFSpellCasterClasses.updateMaxSpellsPerDay err",e),i()}}))}function sl(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["condition_spell_notes","condition-Deafened","condition-Grappled","condition-Pinned"],(function(e){var t={},n="";parseInt(e["condition-Deafened"],10)&&(n+="**"+Qa("deafened")+"**: ",n+=Qa("condition-deafened-spellonly")+"\r\n"),parseInt(e["condition-Grappled"],10)&&(n+="**"+Qa("grappled")+"**: ",n+=Qa("condition-grappled-spell-note")+"\r\n"),parseInt(e["condition-Pinned"],10)&&(n+="**"+Qa("pinned")+"**: ",n+=Qa("condition-pinned-spell-note")+" ",n+=Qa("condition-grappled-spell-note")+"\r\n"),n!==e.condition_spell_notes&&(t.condition_spell_notes=n,Ja(t,o.silentParams)),a()}))}function cl(e,t,a,r,i,s){var c=Va.once((function(){"function"==typeof r&&r()}));getAttrs(["use_spells","spellclass-"+e+"-level","spellclass-"+e+"-level-total","spellclass-"+e+"-level-misc-mod","buff_CasterLevel-total","CasterLevel-Penalty","spellclass-"+e+"-exists"],(function(t){var r=a||parseInt(t["spellclass-"+e+"-level"],10)||0,l=parseInt(t["spellclass-"+e+"-level-total"],10)||0,u=parseInt(t["spellclass-"+e+"-exists"],10)||0,p=parseInt(t.use_spells,10)||0,d=0,f={},m=0,_={};try{p?((d=r+(parseInt(t["spellclass-"+e+"-level-misc-mod"],10)||0)+(parseInt(t["buff_CasterLevel-total"],10)||0)+(parseInt(t["CasterLevel-Penalty"],10)||0))<=0&&(d=r>0?1:0),d!==l&&(f["spellclass-"+e+"-level-total"]=d,r>0&&(m=1)),r>0?(0===u&&(f["spellclass-"+e+"-exists"]=1,m=1),s&&(m=1)):1===u&&(f["spellclass-"+e+"-exists"]=0)):1===u&&(f["spellclass-"+e+"-exists"]=0)}catch(e){n().error("PFSpellCasterClasses.updateCasterLevel",e)}finally{Va.size(f)>0?(i&&(_=o.silentParams),Ja(f,_,(function(){m?function(e,t,a){var n=Va.once((function(){"function"==typeof t&&t()})),r=Va.after(5,n),i=Va.after(10,r);Va.times(10,(function(t){il(e,t,i)})),al(e,0,r,a),nl(e,0,r,a),tl(e,0,!1,r,a),rl(e,0,r)}(e,c,i):c()}))):c()}}))}function ol(e,t,a,r){var i=Va.once((function(){"function"==typeof a&&a()})),s="spellclass-"+e,c="spellclass-"+e+"-level";getAttrs([s,c],(function(t){var a,r,o,l=parseInt(t[s],10),u=parseInt(t[c],10);try{if(isNaN(l)||!t[s]||-1===parseInt(t[s],10))return void i();a="spellclass-"+e+"-name",r="class-"+l+"-name",o="class-"+l+"-level",6===l&&(r="race",o="npc-hd-num"),getAttrs([r,o,a],(function(t){var s={},l=0,p=parseInt(t[o],10)||0;try{(u!==p||isNaN(u))&&(s[c]=p,l=1),t[r]&&t[r]!==t[a]&&(s[a]=t[r])}catch(e){n().error("PFSpellCasterClasses.setCasterClassFromDropdown",e)}finally{Va.size(s)>0?(Ja(s,{silent:!0},i),l&&cl(e,0,p)):i()}}))}catch(e){n().error("PFSpellCasterClasses.setCasterClassFromDropdown outer",e),i()}}))}function ll(e,t,a,n,r){Va.once((function(){"function"==typeof n&&n()}));var i="spellclass-0",s="spellclass-1",c="spellclass-2";e="npc-hd-num"===e?6:parseInt(e,10)||0,getAttrs([i,s,c],(function(t){var n,r,o,l,u;if(parseInt(t[i],10)===e)n=0;else if(parseInt(t[s],10)===e)n=1;else{if(parseInt(t[c],10)!==e)return;n=2}r=(l="spellclass-"+n)+"-level",o="class-"+e+"-level",u="class-"+e+"-name",getAttrs([r,o,u],(function(t){var n={},i=parseInt(t[o],10)||0,s=parseInt(t[r],10);(i!==s||isNaN(s)||a)&&(n[r]=i,n[l+"-name"]=t[u],Ja(n,{silent:!0}),cl(e,0,i))}))}))}Va.each(Xo,(function(e){var t=Vo.saveEventsAuto.replace(/REPLACE/g,e);on(t,n().callback((function(t){"sheetworker"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event for "+e+": "+t.sourceType),Ko(e,t))})))})),Va.each(Xo,(function(e){var t=Vo.saveEventsPlayer.replace(/REPLACE/g,e);on(t,n().callback((function(t){"player"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event for "+e+": "+t.sourceType),Ko(e,t))})))}));var ul=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFSpellCasterClasses.recalculate"),"function"==typeof e&&e()})),i=Va.once((function(){Qo(0,0,(function(){Gs(r,t,a)}))})),s=Va.once((function(){!function(e,t){Va.once((function(){"function"==typeof e&&e()}));var a=Va.after(3,(function(){el(e)}));Va.each(o.spellClassIndexes,(function(e){try{ol(e,0,(function(){cl(e,0,0,a,t,!0)}))}catch(e){n().error("PFSpellCasterClasses.recalculate_recalcTopSection",e),a()}}))}(i,t)})),c=Va.once((function(){sl(s)}));!function(e){"function"==typeof e&&e()}((function(){c()}))})),pl={spellcastingClassEventsAuto:{"change:concentration-REPLACE-mod":[rl,nl,al,Us],"change:concentration-REPLACE-ability":[nl,Us],"change:spellclass-REPLACE-level-total":[nl,al,tl,Bs],"change:concentration-REPLACE-misc-mod":[al,Bs],"change:spellclass-REPLACE-SP-mod":[Bs],"change:spellclass-REPLACE-level-misc-mod":[cl],"change:buff_SpellDC_REPLACE-total":[nl,Us]},spellcastingClassEventsPlayer:{"change:concentration-REPLACE-def":[Bs],"change:spellclass-REPLACE-savedc-misc":[nl,Us]},spellcastingClassEventsIgnoreLevel:{"change:spellclass-REPLACE":[ol],"change:spellclass-REPLACE-level":[cl,Qo],"change:buff_CasterLevel-total change:condition-Drained change:CasterLevel-Penalty":[function(e,t,a,n){cl(0,0,0,a,n),cl(1,0,0,a,n),cl(2,0,0,a,n)}]},spellcastingClassEventsPerSpellLevel:"change:spellclass-CLASSIDX-level-SPELLLEVEL-class change:spellclass-CLASSIDX-level-SPELLLEVEL-bonus change:spellclass-CLASSIDX-level-SPELLLEVEL-misc"};Va.each(o.spellClassIndexes,(function(e){var t=parseInt(e,10)||0;on("change:Concentration-"+t+"-ability",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Bn("Concentration-"+t+"-ability","Concentration-"+t+"-mod")}))),Va.each(pl.spellcastingClassEventsPlayer,(function(e,a){var r=a.replace(/REPLACE/g,t);Va.each(e,(function(e){on(r,n().callback((function(a){"player"!==a.sourceType&&"api"!==a.sourceType||(n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),Jo(t,(function(){e(t,a)})))})))}))})),Va.each(pl.spellcastingClassEventsAuto,(function(e,a){var r=a.replace(/REPLACE/g,t);Va.each(e,(function(e){on(r,n().callback((function(a){"sheetworker"!==a.sourceType&&"api"!==a.sourceType||(n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),Jo(t,(function(){e(t,a)})))})))}))})),Va.each(pl.spellcastingClassEventsIgnoreLevel,(function(e,a){var r=a.replace(/REPLACE/g,t);Va.each(e,(function(e){on(r,n().callback((function(a){n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),e(t,a)})))}))})),Va.each(Ns,(function(e){var a=parseInt(e,10),r=pl.spellcastingClassEventsPerSpellLevel.replace(/CLASSIDX/g,t).replace(/SPELLLEVEL/g,a);on(r,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Jo(t,(function(){il(t,a)}))})))})),on("change:spellclass-0-exists change:spellclass-1-exists change:spellclass-2-exists",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),el(null))}))),on("change:use_metrics",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),tl(t,0,!0,null,!0))})))}));var dl=["skill","fcskill","fcalt","bab","Fort","Ref","Will","level"],fl=["skill","bab","Fort","Ref","Will","hd-num"],ml=["0","1","2","3","4","5"],_l={basehp:"change:auto_calc_hp change:autohp_percent change:maxhp_lvl1",racialhp:"change:npc-hd-num change:npc-hd change:npc-hp",perClassRowhp:"change:class-REPLACE-level change:class-REPLACE-hd change:class-REPLACE-hp change:class-REPLACE-fchp"};function gl(){getAttrs(["multiclassed","class-0-level","class-1-level","class-2-level","class-3-level","class-4-level","class-5-level","npc-hd-num"],(function(e){var t=parseInt(e.multiclassed,10)||0;Math.min(1,parseInt(e["class-0-level"],10)||0)+Math.min(1,parseInt(e["class-1-level"],10)||0)+Math.min(1,parseInt(e["class-2-level"],10)||0)+Math.min(1,parseInt(e["class-3-level"],10)||0)+Math.min(1,parseInt(e["class-4-level"],10)||0)+Math.min(1,parseInt(e["class-5-level"],10)||0)+Math.min(1,parseInt(e["npc-hd-num"],10)||0)>1?t||Ja({multiclassed:1}):t&&Ja({multiclassed:0})}))}function bl(e,t,a,r){var i=function(){"function"==typeof t&&t()};if(!e||"hd"===e||"hp"===e)return n().warn("at updateClassInformation called with bad column:"+e),void i();/^npc/i.test(e)&&(e=e.slice(4)),function(e,t,a){var n,r,s,c,l,u,p,d,f,m,_,g,b,h=[];if("fchp"===e?e="hp":"hd-num"===e&&(e="level"),h=[n="bab"===e||"level"===e?e:"total-"+e,r="class-0-"+e,s="class-1-"+e,c="class-2-"+e,l="class-3-"+e,u="class-4-"+e,p="class-5-"+e],"skill"!==e){switch(e){case"bab":case"Fort":case"Will":case"Ref":h=h.concat(["npc-"+e]);break;case"level":h=h.concat(["npc-hd-num"])}pn(h,0,[],0,i,a)}else d="class-0-level",f="class-1-level",m="class-2-level",_="class-3-level",g="class-4-level",b="class-5-level",h=h.concat([d,f,m,_,g,b,"npc-skill","npc-hd-num"]),getAttrs(h,(function(e){var t,h,y={},v={};h=Math.floor((parseFloat(e[r],10)||0)*(parseInt(e[d],10)||0)+(parseFloat(e[s],10)||0)*(parseInt(e[f],10)||0)+(parseFloat(e[c],10)||0)*(parseInt(e[m],10)||0)+(parseFloat(e[l],10)||0)*(parseInt(e[_],10)||0)+(parseFloat(e[u],10)||0)*(parseInt(e[g],10)||0)+(parseFloat(e[p],10)||0)*(parseInt(e[b],10)||0)+(parseFloat(e["npc-skill"],10)||0)*(parseInt(e["npc-hd-num"],10)||0)),t=parseInt(e[n],10),isNaN(t)||h!==t?(y[n]=h,a&&(v=o.silentParams),Ja(y,v,i)):i()}))}(e,0,a)}function hl(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["auto_calc_hp","autohp_percent","maxhp_lvl1","is_npc","set_pfs","total-hp","NPC-HP","npc-hd-num","npc-hd","class-0-hp","class-0-level","class-0-hd","class-0-fchp","class-1-hp","class-1-level","class-1-hd","class-1-fchp","class-2-hp","class-2-level","class-2-hd","class-2-fchp","class-3-hp","class-3-level","class-3-hd","class-3-fchp","class-4-hp","class-4-level","class-4-hd","class-4-fchp","class-5-hp","class-5-level","class-5-hd","class-5-fchp"],(function(e){var t,i=0,s=0,c=1,l=0,u={},p={},d=0,f=0,m=0,_=0,g=0,b=-1;try{i=parseInt(e.auto_calc_hp,10)||0,a&&a.sourceAttribute&&((t=a.sourceAttribute.match(/(\d)/))&&t[1]?b=parseInt(t[1],10)||0:/NPC/i.test(a.sourceAttribute)&&(b=6)),i&&(l=parseInt(e.set_pfs,10)||0,parseInt(e.is_npc,10)||0,c=function(e){var t=0;switch(e=parseInt(e,10)||0){case 1:default:t=.5;break;case 2:t=.75;break;case 3:t=1}return t}(e.autohp_percent),(s=parseInt(e.maxhp_lvl1,10)||0)&&6===b&&(b=-1)),m=parseInt(e["npc-hd-num"],10)||0,_=parseInt(e["npc-hd"],10),d=parseInt(e["NPC-HP"],10)||0,isNaN(_)||!i?g+=d:m>0&&_>0?(6===b||-1===b?(f=Pn(m,_,c,s,!1),g+=f,f!==d&&(u["NPC-HP"]=f)):g+=d,s&&(s=0)):0===_&&0!==d&&(u["NPC-HP"]=0),Va.each(ml,(function(t){var a,n=parseInt(t,10);f=0,m=parseInt(e["class-"+t+"-level"],10)||0,_=parseInt(e["class-"+t+"-hd"],10),d=parseInt(e["class-"+t+"-hp"],10)||0,a=parseInt(e["class-"+t+"-fchp"],10)||0,isNaN(_)||!i?g+=d+a:m>0&&_>0?(-1===b||b===n?(f=Pn(m,_,c,s,l),g+=f+a,f!==d&&(u["class-"+t+"-hp"]=f)):g+=d+a,s&&(s=0)):0===_&&0!==d&&(u["class-"+t+"-hp"]=0)})),g!==parseInt(e["total-hp"],10)&&(p["total-hp"]=g)}catch(e){n().error("PFClassRaceGrid.setHitPoints",e)}finally{Va.size(p)>0&&Ja(p),Va.size(u)>0?Ja(u,o.silentParams,r):r()}}))}var yl,vl=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFClassRaceGrid.recalculate"),"function"==typeof e&&e()})),i=dl.length,s=Va.after(i,(function(){hl(r)}));Va.each(dl,(function(e){bl(e,s,t)})),gl()}));function kl(e,t,a,n,r){var i=0;e<=t&&(i=e>a?1:e>n?2:3),i!==r&&Ja({"condition-Wounds":i})}function wl(e,t,a,r,i){var s={},c=0,l=0,u=0,p=0;try{c=Math.floor(.75*t),l=Math.floor(.5*t),u=Math.floor(.25*t),p=-1*(r>0?r:0),(parseInt(i.HP_grazed,10)||0)!==c&&(s.HP_grazed=c),(parseInt(i.HP_wounded,10)||0)!==l&&(s.HP_wounded=l),(parseInt(i.HP_critical,10)||0)!==u&&(s.HP_critical=u),(parseInt(i.HP_disabled,10)||0)!==p&&(s.HP_disabled=p)}catch(e){n().error("PFHealth.setWoundThresholds",e)}finally{Va.size(s)>0?Ja(s,o.silentParams,(function(){kl(e,c,l,u,a)})):kl(e,c,l,u,a)}}function Al(){getAttrs(["HP","HP_max","wound_threshold-show","condition-Wounds","HP-ability-mod","HP_grazed","HP_wounded","HP_critical","HP_disabled"],(function(e){1===parseInt(e["wound_threshold-show"],10)?wl(parseInt(e.HP,10)||0,parseInt(e.HP_max,10)||0,parseInt(e["condition-Wounds"],10)||0,parseInt(e["HP-ability-mod"],10)||0,e):0!==(parseInt(e["condition-Wounds"],10)||0)&&Ja({"condition-Wounds":"0"})}))}function Cl(e,t,a,n,r,i,s){"0"!==r&&(a>=e+t+(n?1+i:0)?Ja({"condition-Staggered":"1"},o.silentParams):s&&Ja({"condition-Staggered":"0"},o.silentParams)),n&&function(e){getAttrs(["HP","HP_grazed","HP_wounded","HP_critical","condition-Wounds","wound_threshold-show"],(function(t){parseInt(t["wound_threshold-show"],10)&&(isNaN(parseInt(e,10))&&(e=parseInt(t.HP,10)||0),kl(e,parseInt(t.HP_grazed,10)||0,parseInt(t.HP_wounded,10)||0,parseInt(t.HP_critical,10)||0,parseInt(t["condition-Wounds"],10)||0))}))}(e)}function Il(){getAttrs(["HP","HP-temp","non-lethal-damage","wound_threshold-show","HP-ability","HP-ability-mod","condition-Staggered"],(function(e){Cl(parseInt(e.HP,10)||0,parseInt(e["HP-temp"],10)||0,parseInt(e["non-lethal-damage"],10)||0,parseInt(e["wound_threshold-show"],10)||0,e["HP-ability"],parseInt(e["HP-ability-mod"],10)||0,parseInt(e["condition-Staggered"],10)||0),e.HP&&Ja({HP:parseInt(e.HP,10)||0})}))}function xl(e,t,a,r){var i=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["HP","HP_max","HP-ability","HP-ability-mod","level","total-hp","total-mythic-hp","condition-Drained","HP-formula-mod","HP-temp","mythic-adventures-show","wound_threshold-show","condition-Wounds","non-lethal-damage","non-lethal-damage_max","condition-Staggered","hp_ability_bonus","HP_grazed","HP_wounded","HP_critical","HP_disabled","increase_hp"],(function(e){var t=0,a=0,s=0,c=0,l=0,u=0,p=0,d=0,f=0,m=0,_=0,g=0,b={};try{p=parseInt(e.increase_hp,10)||0,a=(t=parseInt(e["HP-ability-mod"],10)||0)*(parseInt(e.level,10)||0),s=parseInt(e.HP_max,10)||0,c=parseInt(e.HP,10)||0,l=parseInt(e["HP-temp"],10)||0,g=parseInt(e["wound_threshold-show"],10)||0,u=c,d=parseInt(e["non-lethal-damage"],10)||0,m=parseInt(e["mythic-adventures-show"],10)||0,f=a+(parseInt(e["total-hp"],10)||0)+(parseInt(e["HP-formula-mod"],10)||0)+5*(parseInt(e["condition-Drained"],10)||0)+(m&&parseInt(e["total-mythic-hp"],10)||0),g&&(_=parseInt(e["condition-Wounds"],10)||0),r?(u=f,0!==d&&(b["non-lethal-damage"]=0,b["condition-Staggered"]=0),g&&(b["condition-Wounds"]=0)):u=c+f-s,a!==parseInt(e.hp_ability_bonus,10)&&(b.hp_ability_bonus=a),p&&u!==c?b.HP=u:p||(u=c),s!==f&&(b.HP_max=f),f!==parseInt(e["non-lethal-damage_max"],10)&&(b["non-lethal-damage_max"]=f)}catch(e){n().error("PFHealth.updateMaxHPLookup",e)}finally{Va.size(b)>0?Ja(b,o.silentParams,(function(){p&&!r&&s!==f&&(Cl(u,l,d,0,e["HP-ability"],t,e["condition-Staggered"]),g&&wl(u+l,f,_,t,e)),i()})):i()}}))}function Pl(e,t,a,r){var i=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["HP-temp","HP-temp_max","HP-temp-misc","buff_HP-temp-total"],(function(e){var s,c,l,u=0,p=0,d={};try{r&&"buff_hp-temp-total"===r.sourceAttribute?(parseInt(r.previousValue,10)||0)!==(parseInt(r.newValue,10)||0)&&(u=(parseInt(r.newValue,10)||0)-(parseInt(r.previousValue,10)||0)):r&&"hp-temp-misc"===r.sourceAttribute&&(parseInt(r.previousValue,10)||0)!==(parseInt(r.newValue,10)||0)&&(p=(parseInt(r.newValue,10)||0)-(parseInt(r.previousValue,10)||0)),s=(parseInt(e["HP-temp-misc"],10)||0)+(parseInt(e["buff_HP-temp-total"],10)||0),c=parseInt(e["HP-temp"],10)||0,l=a?s:c+u+p,s=Math.max(s,0),l=Math.max(l,0),l=Math.min(l,s),a||l!==c?(t&&(d=o.silentParams),Ja({"HP-temp":l,"HP-temp_max":s},d,(function(){Il(),i()}))):i()}catch(e){n().error("updateTempMaxHP",e),i()}}))}function Sl(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));Ja({use_prestige_fame:1,auto_calc_hp:1,autohp_percent:1,maxhp_lvl1:1},o.silentParams,(function(){t&&hl(a,0,t)}))}function Tl(e,t){Jn(Va.once((function(){"function"==typeof e&&e()}))),t<1.18&&getAttrs(["npc-hd","npc-hd-num","NPC-HP","is_npc"],(function(e){var t=parseInt(e["npc-hd"],10)||0,a=parseInt(e["npc-hd-num"],10)||0,n=parseInt(e["NPC-HP"],10)||0;parseInt(e.is_npc,10)?Ja({"npc-hd-num2":0,"npc-hd2":0,"HP-misc":"","HP-misc-mod":0}):t||a||!n||Ja({"npc-hd-num":"","NPC-HP":0})}))}yl="",Va.each(dl,(function(e){var t=Va.map(ml,(function(t){return"change:class-"+t+"-"+e})).join(" ");on(t,n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||bl(e,null,null)}))),"level"===e&&on(t,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(bl("skill",null,null),gl())})))})),Va.each(fl,(function(e){on("change:npc-"+e,n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),("player"===t.sourceType||"api"===t.sourceType||"sheetworker"===t.sourceType||"api"===t.sourceType&&"hp"===t.sourceAttribute.slice(-2))&&("hd-num"===e?(bl("level",null,null),bl("skill",null,null),gl()):bl(e,null,null))})))})),Va.each(ml,(function(e){yl=_l.perClassRowhp.replace(/REPLACE/g,e),on(yl,n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||(hl(null,0,t),/level/i.test(t.sourceAttribute)&&ll(parseInt(e,10)))})))})),on(_l.racialhp,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(hl(null,0,e),"npc-hd-num"===e.sourceAttribute&&ll(6))}))),on(_l.basehp,n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||hl()}))),on("change:class-0-level change:class-1-level change:class-2-level change:class-3-level change:class-4-level change:class-5-level change:bab change:level",n().callback((function(e){("level"!==e.sourceAttribute&&"bab"!==e.sourceAttribute||"sheetworker"!==e.sourceType)&&"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Va.each(o.levelPlusBABManualDropdowns,(function(e){un(e,e+"-mod")})))})));var El=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFHealth.recalculate"),"function"==typeof e&&e()})),i=Va.once((function(){Al(),r()})),s=Va.once((function(){xl(i)}));Tl(Va.once((function(){Pl(s)})),a)}));function Dl(e,t){var a=function(){"function"==typeof e&&e()};getAttrs(["condition-Blinded","condition-Fear","condition-Drained","condition-Sickened","condition-Wounds","has_endurance_feat","wounds_gritty_mode","checks-cond","Phys-skills-cond","wound_threshold-show","CasterLevel-Penalty","condition-Dazzled","condition-Deafened","condition-Fascinated","condition_skill_notes","condition_init_notes"],(function(e){var t={},r=0,i=0,s=0,c=0,o=0,l=0,u=0,p=0,d=0,f=0,m=0,_="",g="";try{r=parseInt(e["condition-Drained"],10)||0,i=-1*(parseInt(e["condition-Fear"],10)||0),s=-1*(parseInt(e["condition-Sickened"],10)||0),c=An(parseInt(e["condition-Wounds"],10)||0,parseInt(e.has_endurance_feat,10)||0,parseInt(e.wounds_gritty_mode,10)||0),l=r+i+s+(o=(parseInt(e["wound_threshold-show"],10)||0)*c),u=r+o,p=-2*(parseInt(e["condition-Blinded"],10)||0),d=parseInt(e["checks-cond"],10)||0,f=parseInt(e["Phys-skills-cond"],10)||0,m=parseInt(e["CasterLevel-Penalty"],10)||0,(l!==d||isNaN(d))&&(t["checks-cond"]=l),(p!==f||isNaN(f))&&(t["Phys-skills-cond"]=p),(u!==m||isNaN(m))&&(t["CasterLevel-Penalty"]=u),p&&(_+="**"+Qa("blinded")+"**: ",_+=Qa("condition-blinded-note")+"\r\n",g+=Qa("blinded")+": ",g+=Qa("condition-blinded-speed")+"\r\n"),parseInt(e["condition-Dazzled"],10)&&(_+="**"+Qa("dazzled")+"**: ",_+=Qa("condition-dazzled-note")+"\r\n"),parseInt(e["condition-Deafened"],10)&&(_+="**"+Qa("deafened")+"**: ",_+=Qa("condition-deafened-note")+"\r\n"),parseInt(e["condition-Fascinated"],10)&&(_+="**"+Qa("fascinated")+"**: ",_+=Qa("condition-fascinated-title")+"\r\n"),_!==e.condition_skill_notes&&(t.condition_skill_notes=_),g!==e.condition_init_notes&&(t.condition_init_notes=g)}catch(e){n().error("PFChecks.applyConditions",e)}finally{Va.size(t)>0?(Ja(t,{},a),l!==d&&Ci(l,d)):a()}}))}function Ml(e,t,a){getAttrs(["nodex-toggle"],(function(a){parseInt(a["nodex-toggle"],10)?pn(["init","init-trait","init-misc-mod","checks-cond","buff_initiative-total","buff-Check-total","buff_check_ability-total"],0,["condition-Deafened"],!1,e,t):pn(["init","init-ability-mod","init-trait","init-misc-mod","checks-cond","buff_initiative-total","buff_Check-total","buff_check_ability-total"],0,["condition-Deafened"],!1,e,t)}))}on("change:set_pfs",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["set_pfs"],(function(t){parseInt(t.set_pfs,10)&&Sl(null,e)}))}))),on("change:hp-ability-mod change:level change:total-hp change:total-mythic-hp change:hp-formula-mod ",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||xl()}))),on("change:mythic-adventures-show",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["total-mythic-hp"],(function(e){(parseInt(e["total-mythic-hp"],10)||0)>0&&xl()}))}))),on("change:hp-temp-misc",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||Pl(null,null,!1,e)}))),on("change:hp_reset",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(xl(null,0,0,!0),Pl(null,null,!0,e),Ja({HP_reset:"0"},o.silentParams))}))),on("change:HP change:non-lethal-damage",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Il())}))),on("change:wound_threshold-show",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||Al()})));var Fl=n().callback((function(e,t,a){var r=Va.once((function(){n().info("Leaving PFInitiative.recalculate"),"function"==typeof e&&e()}));!function(e,t){var a=function(){"function"==typeof e&&e()};t<1.18?Ml(a,!1):a()}((function(){Ml(r,t)}),a)}));on("change:init-trait change:condition-Deafened ",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||Ml()}))),on("change:init-ability-mod change:init-misc-mod change:checks-cond change:nodex-toggle",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Ml())})));var Nl=["Ranged","Melee","CMB","DMG","DMG_ranged","AC","Touch","CMD","flat-footed","speed","initiative","size","check_skills","HP-temp","Fort","Will","Ref","Check","CasterLevel","STR","DEX","CON","INT","WIS","CHA","STR_skills","DEX_skills","CON_skills","INT_skills","WIS_skills","CHA_skills"],Rl={Check:"check_ability",DMG:"dmg_melee"},zl=Va.chain(Nl).map((function(e){return Do.indexOf(e)>=0&&e.indexOf("skill")<1?["buff_"+e+"-total","buff_"+e+"_exists","buff_"+e+"-total_penalty","buff_"+e+"_penalty_exists"]:["buff_"+e+"-total","buff_"+e+"_exists"]})).flatten().value().concat(["buff_check_ability-total","buff_dmg_melee-total"]);function Ll(e,t){var a=function(){"function"==typeof e&&e()};getAttrs(zl,(function(e){var n={},r={};n=Va.reduce(Nl,(function(t,a){var n=parseInt(e["buff_"+a+"-total"],10)||0,r=parseInt(e["buff_"+a+"_exists"],10)||0;return n&&(t["buff_"+a+"-total"]=0),r&&(t["buff_"+a+"_exists"]=0),t}),{}),n=Va.reduce(Do,(function(t,a){var n=parseInt(e["buff_"+a+"-total_penalty"],10)||0,r=parseInt(e["buff_"+a+"_penalty_exists"],10)||0;return n&&(t["buff_"+a+"-total_penalty"]=0),r&&(t["buff_"+a+"_penalty_exists"]=0),t}),n),Va.size(n)?(t&&(r=o.silentParams),Ja(n,r,a)):a()}))}function Ol(e,t,a,r){var i=0,s={sum:0,pen:0},c=e,o=[];try{r=r||{},Rl[e]&&(c=Rl[e]),Ai(),n().notice("Updating "+e+" the total is "+c,Rl,a),i=Do.indexOf(e)>=0&&e.indexOf("skill")<9,t=t.filter((function(t){var n="repeating_buff_"+t+"_buff-";return 0!==(parseInt(a[n+e+"-show"],10)||0)&&0!==(parseInt(a[n+e],10)||0)})),n().debug("updating "+e+" there are "+Va.size(t)+" rows"),Va.size(t)>0&&(o=t.map((function(t){return parseInt(a["repeating_buff_"+t+"_buff-"+e],10)||0})),n().debug("PFBuffsOld ROWS NOW:",o),"HP-temp"===e?s.sum=o.filter((function(e){return e>0})).reduce((function(e,t){return e+=t}),0):"size"===e?((s=o.reduce((function(e,t){return t>0?e.sum=Math.max(e.sum,t):t<0&&(e.pen=Math.min(e.pen,t)),e}),s)).sum+=s.pen,s.pen=0):i?s=o.reduce((function(e,t){return t<0?e.pen+=t:t>0&&(e.sum+=t),e}),s):(n().debug("now calculating sum for "+e),s.sum=o.reduce((function(t,a){return n().debug("ADDING "+a+" to m for "+e+" is "+a),t+=a}),0),n().debug("calculating "+e+" sum is "+s.sum))),(parseInt(a["buff_"+c+"-total"],10)||0)!==s.sum&&(r["buff_"+c+"-total"]=s.sum),s.sum?r["buff_"+c+"_exists"]=1:1===(parseInt(a["buff_"+c+"_exists"],10)||0)&&(r["buff_"+c+"_exists"]=0),i&&((parseInt(a["buff_"+c+"-total_penalty"],10)||0)!==s.pen&&(r["buff_"+c+"-total_penalty"]=s.pen),s.pen?r["buff_"+c+"_penalty_exists"]=1:1===(parseInt(a["buff_"+c+"_penalty_exists"],10)||0)&&(r["buff_"+c+"_penalty_exists"]=0))}catch(e){n().error("PFBuffsOld.updateBuffTotal",e)}finally{return r}}function ql(e,t,a){var r=Va.once((function(){"function"==typeof t&&t()})),i=Do.indexOf(e)>=0&&e.indexOf("skill")<9;getSectionIDs("repeating_buff",(function(t){var s,c,l=e;t?(Rl[e]&&(l=Rl[e]),s=bn(["repeating_buff_"],t,["_buff-"+e,"_buff-"+e+"-show","_buff-enable_toggle"]),c=["buff_"+l+"-total","buff_"+l+"_exists"],i&&(c=c.concat(["buff_"+l+"-total_penalty","buff_"+l+"_penalty_exists"])),s=s.concat(c),getAttrs(s,(function(i){var s={},c={};try{t=t.filter((function(e){return parseInt(i["repeating_buff_"+e+"_buff-"+"enable_toggle"],10)||0})),c=Ol(e,t,i,c),Rl[e]&&(c["buff_"+e+"-total"]=0,c["buff_"+e+"_exists"]=0,c["buff_"+e+"-total_penalty"]=0,c["buff_"+e+"_penalty_exists"]=0)}catch(t){n().error("PFBuffsOld.updateBuffTotalAsync errou on col "+e,t)}finally{Va.size(c)?(n().debug("######################","PFBuffsOld setting ",c),a&&(s=o.silentParams),Ja(c,s,r)):r()}}))):r()}))}function Hl(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));n().debug("PFBuffsOld.updateAllBuffTotalsAsync"),getSectionIDs("repeating_buff",(function(e){var r;e&&0!==Va.size(e)?((r=(r=(r=bn(["repeating_buff_"],e,["_buff-"],Nl,["","-show"])).concat(bn(["repeating_buff_"],e,["_buff-enable_toggle"]))).concat(zl)).push("use_buff_bonuses"),n().debug("############ BUFF FIELDS ARE:",r),getAttrs(r,(function(r){var i={},s={};try{if(n().debug("PFBuffsOld.updateAllBuffTotalsAsync found:",r),parseInt(r.use_buff_bonuses,10)||0,!(e=e.filter((function(e){return parseInt(r["repeating_buff_"+e+"_buff-enable_toggle"],10)})))||0===Va.size(e))return n().debug("there are no ids with enable toggle checked"),void Ll(a,t);Va.each(Nl,(function(t){s=Ol(t,e,r,s)}))}catch(e){n().error("PFBuffsOld.updateAllBuffTotalsAsync errou on col ",e)}finally{Va.size(s)?(n().debug("######################","PFBuffsOldsetting ",s),t&&(i=o.silentParams),Ja(s,i,a)):a()}}))):Ll(a,t)}))}function Bl(e,t){var a=Va.once((function(){!function(e){var t,a=Va.once((function(){"function"==typeof e&&e()}));try{t=bn(["buff_"],Nl,["-total","_exists"]).concat(bn(["buff_"],Do,["-total_penalty","_penalty_exists"]))}catch(e){return n().error("PFBuffsOld.resetStatuspanel error creating field array, abort:",e),void a()}getAttrs(t,(function(e){var t={},r=function(t,a){var n,r;return a=a||"",n=parseInt(e[t+"-total"+a],10)||0,r=parseInt(e[t+a+"_exists"],10)||0,0===n||r?0===n&&r?0:void 0:1};try{t=Va.reduce(Nl,(function(e,t){var a,n;try{((n=r(a="buff_"+t,""))||0===n)&&(e[a+"_exists"]=n)}catch(e){}finally{return e}}),t),t=Va.reduce(Do,(function(e,t){var a,n;try{((n=r(a="buff_"+t,"_penalty"))||0===n)&&(e[a+"_penalty_exists"]=n)}catch(e){}finally{return e}}),t)}catch(e){n().error("PFBuffsOld.resetStatuspanel error inside calculate exists",e)}finally{Va.size(t)>0?Ja(t,{silent:!0},a):a()}}))}(),"function"==typeof e&&e()})),r=Va.size(Nl),i=Va.after(r,(function(){Hl(a,t)}));getSectionIDs("repeating_buff",(function(e){try{Va.size(e)>0?Va.each(Nl,(function(t){!function(e,t){var a,r=Va.size(e);if(n().debug("PFBuffsOld.recalculateBuffColumn:"+t),"size"!==t){a=Va.after(r,(function(){i()}));try{if("size"===t)return void i();Va.each(e,(function(e){try{getAttrs(["repeating_buff_"+e+"_buff-enable_toggle","repeating_buff_"+e+"_buff-"+t+"-show"],(function(n){parseInt(n["repeating_buff_"+e+"_buff-enable_toggle"],10)&&parseInt(n["repeating_buff_"+e+"_buff-"+t+"-show"],10)?an("repeating_buff_"+e+"_buff-"+t+"_macro-text","repeating_buff_"+e+"_buff-"+t,0,a,!0):a()}))}catch(r){n().error("PFBuffsOld.recalculate_recalculateBuffColumn:"+t+", rowid"+e,r),a()}}))}catch(e){n().error("PFBuffsOld.recalculate_recalculateBuffColumn OUTER error:"+t,e),i()}}else i()}(e,t)})):Ll(a)}catch(e){n().error("PFBuffsOld.recalculate.recalculateAll",e),a()}}))}function Ul(e){!function(e){var t=Va.once((function(){"function"==typeof e&&e()})),a=function(){Ja({migrated_buffs_rangeddmg_ability:1},o.silentParams,t)};getAttrs(["migrated_buffs_rangeddmg_ability"],(function(e){parseInt(e.migrated_buffs_rangeddmg_ability,10)||0?t():getSectionIDs("repeating_buff",(function(e){var t;Va.size(e)?(t=(t=bn(["repeating_buff_"],e,["_buff-DMG_macro-text","_buff-DMG","_buff-DMG-show","_buff-DMG_ranged_macro-text","_buff-DMG_ranged","_buff-Melee_macro-text","_buff-Melee","_buff-Melee-show","_buff-CMB_macro-text","_buff-CMB_ranged","_buff-Check_macro-text","_buff-Check","_buff-Check-show","_buff-check_skills_macro-text","_buff-check_skills"])).concat(["buff_Check-total","buff_check_skills-total","buff_Melee-total","buff_DMG-total","buff_DMG_ranged-total","buff-CMB-total"]),getAttrs(t,(function(t){var r={},i=!1,s=0;try{e.forEach((function(e){var a="repeating_buff_"+e+"_buff-";t[a+"DMG_macro-text"]&&!t[a+"DMG_ranged_macro-text"]&&(r[a+"DMG_ranged_macro-text"]=t[a+"DMG_macro-text"],r[a+"DMG_ranged"]=parseInt(t[a+"DMG"],10)||0,parseInt(t[a+"DMG-show"],10)&&(r[a+"DMG_ranged-show"]=1)),t[a+"Check_macro-text"]&&!t[a+"check_skills_macro-text"]&&(r[a+"check_skills_macro-text"]=t[a+"Check_macro-text"],r[a+"check_skills"]=parseInt(t[a+"Check"],10)||0,i=!0,parseInt(t[a+"Check-show"],10)&&(r[a+"check_skills-show"]=1)),t[a+"Melee_macro-text"]&&!t[a+"CMB_macro-text"]&&(r[a+"CMB_macro-text"]=t[a+"Melee_macro-text"],r[a+"CMB"]=parseInt(t[a+"Melee"],10)||0,i=!0,parseInt(t[a+"Melee-show"],10)&&(r[a+"CMB-show"]=1))})),(s=parseInt(t["buff_DMG-total"],10)||0)&&(r["buff_DMG_ranged-total"]=s+parseInt(t["buff_DMG_ranged-total"],10)||0),(s=parseInt(t["buff_Check-total"],10)||0)&&(r["buff_check_skills-total"]=s+parseInt(t["buff_check_skills-total"],10)||0),(s=parseInt(t["buff_Melee-total"],10)||0)&&(r["buff_CMB-total"]=s+parseInt(t["buff_CMB-total"],10)||0)}catch(e){n().error("PFBuffsOld.migrateDmgAbility",e)}finally{Va.size(r)?(Ja(r,o.silentParams,a),i&&(Dl(),Ml())):a()}}))):a()}))}))}(Va.once((function(){"function"==typeof e&&e()})))}var jl=n().callback((function(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["use_buff_bonuses"],(function(e){parseInt(e.use_buff_bonuses,10)?(n().debug("USING NEW BUFFS"),r()):(n().debug("USING OLD BUFFS"),Ul((function(){Bl(r,t)})))}))}));Va.each(Nl,(function(e){var t="change:repeating_buff:buff-"+e;"size"!==e&&on(t+"_macro-text",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" for column "+e+", event: "+t.sourceType),function(e,t,a,n){var r=function(){"function"==typeof a&&a()},i="repeating_buff_"+gn(e)+"buff-"+t;"size"!==t?an(i+"_macro-text",i,0,(function(e,a,i){i?ql(t,r,n):r()}),!0,r):r()}(null,e)}))),on(t+"-show",n().callback((function(t){"player"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),n().debug("we updated "+e+"!!!!!!!!!!!!!!!!!!!!!!!!!!!!"),getAttrs(["repeating_buff_buff-"+e,"repeating_buff_buff-enable_toggle"],(function(t){parseInt(t["repeating_buff_buff-enable_toggle"],10)&&parseInt(t["repeating_buff_buff-"+e],10)&&(n().debug("Show or don't show update "+e),ql(e))})))})))})),on("change:repeating_buff:buff-size",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),ql("size"))}))),on("remove:repeating_buff",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"===e.sourceType&&Hl()}))),on("change:repeating_buff:buff-enable_toggle",n().callback((function(e){var t;"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),t=(t=Nl.map((function(e){return"repeating_buff_buff-"+e}))).concat(t.map((function(e){return e+"-show"}))),getAttrs(t,(function(e){Va.each(Nl,(function(t){parseInt(e["repeating_buff_buff-"+t+"-show"],10)&&parseInt(e["repeating_buff_buff-"+t],10)&&ql(t)}))})))})));var Wl=["ac","armor","attack","casterlevel","cha","cha_skills","check","check_ability","check_skills","cmb","cmb2","cmd","con","con_skills","crit_conf","customa1","customa10","customa11","customa12","customa2","customa3","customa4","customa5","customa6","customa7","customa8","customa9","dex","dex_skills","dmg","dmg_kineticblast","dmg_melee","dmg_melee2","dmg_power_attack","dmg_ranged","dmg_ranged2","flatfooted","fort","hptemp","initiative","int","int_skills","kineticblast","melee","melee2","natural","ranged","ranged2","ref","saves","shield","size","speed","spelldc_0","spelldc_1","spelldc_2","str","str_skills","touch","will","wis","wis_skills"],Gl={ac:"AC",armor:"armor",attack:"attack",casterlevel:"CasterLevel",cha:"CHA",cha_skills:"CHA_skills",check:"Check",check_ability:"check_ability",check_skills:"check_skills",cmb:"CMB",cmd:"CMD",con:"CON",con_skills:"CON_skills",dex:"DEX",dex_skills:"DEX_skills",dmg:"DMG",dmg_melee:"dmg_melee",dmg_ranged:"dmg_ranged",flatfooted:"flat-footed",fort:"Fort",hptemp:"HP-temp",initiative:"Initiative",int:"INT",int_skills:"INT_skills",melee:"Melee",natural:"natural",ranged:"Ranged",ref:"Ref",saves:"saves",shield:"shield",size:"size",speed:"speed",spelldc_0:"SpellDC_0",spelldc_1:"SpellDC_1",spelldc_2:"SpellDC_2",str:"STR",str_skills:"STR_skills",touch:"Touch",will:"Will",wis:"WIS",wis_skills:"WIS_skills",melee2:"melee2",ranged2:"ranged2",cmb2:"cmb2",dmg_melee2:"dmg_melee2",dmg_ranged2:"dmg_ranged2",kineticblast:"kineticblast",dmg_kineticblast:"dmg_kineticblast",dmg_power_attack:"dmg_power_attack",customa1:"customa1",customa2:"customa2",customa3:"customa3",customa4:"customa4",customa5:"customa5",customa6:"customa6",customa7:"customa7",customa8:"customa8",customa9:"customa9",customa10:"customa10",customa11:"customa11",customa12:"customa12",crit_conf:"crit_conf"},Xl=Va.values(Gl).concat(["dodge"]).sort(),Vl=["armor","shield","natural"],$l={ac:["cmd","touch","flatfooted"],attack:["melee","ranged","cmb","melee2","ranged2","cmb2"],check:["initiative","check_skills","check_ability","str_skills","dex_skills","con_skills","int_skills","wis_skills","cha_skills"],dmg:["dmg_melee","dmg_ranged","dmg_melee2","dmg_ranged2"],dmg_melee:["dmg_melee2"],dmg_ranged:["dmg_ranged2"],saves:["fort","ref","will"],check_skills:["str_skills","dex_skills","con_skills","int_skills","wis_skills","cha_skills"]},Kl={melee:["attack"],melee2:["melee","attack"],ranged:["attack"],ranged2:["ranged","attack"],cmb:["attack"],cmb2:["cmb","attack"],dmg_melee:["dmg"],dmg_melee2:["dmg_melee","dmg"],dmg_ranged:["dmg"],dmg_ranged2:["dmg_ranged","dmg"],cmd:["ac"],flatfooted:["ac"],touch:["ac"],fort:["saves"],ref:["saves"],will:["saves"],check_skills:["check"],check_ability:["check"],initiative:["check_ability","check"],str_skills:["check_skills","check"],dex_skills:["check_skills","check"],con_skills:["check_skills","check"],int_skills:["check_skills","check"],wis_skills:["check_skills","check"],cha_skills:["check_skills","check"]},Yl=Va.chain(Xl).map((function(e){return Do.indexOf(e)>=0&&e.indexOf("skill")<1?["buff_"+e+"-total","buff_"+e+"_exists","buff_"+e+"-total_penalty","buff_"+e+"_penalty_exists"]:["buff_"+e+"-total","buff_"+e+"_exists"]})).flatten().value(),Zl={str:{inherent:"STR-inherent",enhancement:"STR-enhance"},dex:{inherent:"DEX-inherent",enhancement:"DEX-enhance"},con:{inherent:"CON-inherent",enhancement:"CON-enhance"},int:{inherent:"INT-inherent",enhancement:"INT-enhance"},wis:{inherent:"WIS-inherent",enhancement:"WIS-enhance"},cha:{inherent:"CHA-inherent",enhancement:"CHA-enhance"},initiative:{trait:"init-trait"},fort:{resistance:"Fort-resist",trait:"Fort-trait"},ref:{resistance:"Ref-resist",trait:"Ref-trait"},will:{resistance:"Will-resist",trait:"Will-trait"},ac:{deflection:"AC-deflect"},armor:{armor:"armor3-acbonus",enhancement:"armor3-enhance"},shield:{shield:"shield3-acbonus",enhancement:"shield3-enhance"},natural:{natural:"AC-natural"}},Jl={armor:["armor3-equipped"],shield:["shield3-equipped"]},Ql=Va.chain(Zl).values().map((function(e){return Va.values(e)})).flatten().uniq().value().sort(),eu=["buff_attack_notes","buff_save_notes","buff_init_notes","buff_skill_notes","buff_defense_notes"],tu=["b1","b2","b3","b4","b5","b6"],au=["untyped","circumstance","dodge","penalty"],nu=["size","hptemp"],ru=["_b1-show","_b1_val","_b1_bonus","_b1_bonustype","_b2-show","_b2_val","_b2_bonus","_b2_bonustype","_b3-show","_b3_val","_b3_bonus","_b3_bonustype","_b4-show","_b4_val","_b4_bonus","_b4_bonustype","_b5-show","_b5_val","_b5_bonus","_b5_bonustype","_b6-show","_b6_val","_b6_bonus","_b6_bonustype","_enable_toggle","_add_note_to_roll"],iu={buffTotalNonAbilityEvents:{Fort:[Ko],Will:[Ko],Ref:[Ko],STR_skills:[Ii],DEX_skills:[Ii],CON_skills:[Ii],INT_skills:[Ii],WIS_skills:[Ii],CHA_skills:[Ii],Melee:[Sr],Ranged:[Sr],CMB:[Sr],melee2:[Sr],ranged2:[Sr],cmb2:[Sr]},buffTotalAbilityEvents:{STR:[Bo],DEX:[Bo],CON:[Bo],INT:[Bo],WIS:[Bo],CHA:[Bo]},buffEventsTotalOnUpdate:{"buff_Check-total":[Ci],"buff_check_skills-total":[Ci]},buffTotalEventsNoParam:{DMG:[mo],dmg_ranged:[mo],dmg_melee:[mo],dmg_ranged2:[mo],dmg_melee2:[mo],dmg_power_attack:[mo],saves:[Yo],attack:[Pr],AC:[Bi],Touch:[Bi],armor:[Bi],shield:[Bi],dodge:[Bi],natural:[Bi],"flat-footed":[Bi],CMD:[Bi],"HP-temp":[Pl],Check:[Ml],check_ability:[Ml],initiative:[Ml],speed:[qc]}};function su(e){var t=function(t){Ja({merge_buffs_now:0},o.silentParams,(function(){"function"==typeof e&&e()}))};!function(e){getSectionIDs("repeating_buff",(function(t){var a,n;if(!t||!Va.size(t))return e(null,null);n=(n=bn(["_buff-"],Nl,["_macro-text","","-show"])).concat(["_buff-enable_toggle","_buff-name","_buff-notes"]),a=bn(["repeating_buff_"],t,n),getAttrs(a,(function(a){e(t,a)}))}))}((function(e,a){var r={};e&&a?(e.forEach((function(e){var t="repeating_buff_"+e+"_",i="",s="",c=0,o="",l="",u="",p=[];try{p=Object.keys(a).filter((function(e){return 0===e.indexOf(t)})).filter((function(e){return/size$|macro\-text$/i.test(e)})).filter((function(e){return!!a[e]})).map((function(e){return e.indexOf("size")>=0?"size":_n(e).slice(5,-11)})).filter((function(e){return 1===parseInt(a[t+"buff-"+e+"-show"],10)})),Va.size(p)&&(i=generateRowID(),o=(s="repeating_buff2_"+i+"_")+"b",r[s+"enable_toggle"]=a[t+"buff-enable_toggle"]||"0",r[s+"name"]=a[t+"buff-name"]||"",a[t+"buff-notes"]&&(r[s+"notes"]=a[t+"buff-notes"]),p.indexOf("size")>=0&&(c++,r[(l=o+c)+"-show"]=1,r[l+"_macro-text"]=a[t+"buff-size"],r[l+"_val"]=a[t+"buff-size"],r[l+"_bonus"]="size",p=Va.without(p,"size")),p.indexOf("CMD")>=0&&p.indexOf("AC")>=0&&parseInt(a[t+"buff-AC"],10)===parseInt(a[t+"buff-CMD"],10)&&(c++,r[(l=o+c)+"-show"]=1,r[l+"_macro-text"]=a[t+"buff-AC_macro-text"],r[l+"_val"]=a[t+"buff-AC"],r[l+"_bonus"]="ac",p.indexOf("Touch")?r[l+"_bonustype"]="deflection":r[l+"_bonustype"]="untyped",p=Va.without(p,"AC","CMD","flat-footed","Touch")),p.indexOf("Melee")>=0&&p.indexOf("Ranged")>=0&&parseInt(a[t+"buff-Melee"],10)===parseInt(a[t+"buff-Ranged"],10)&&(c++,r[(l=o+c)+"-show"]=1,r[l+"_macro-text"]=a[t+"buff-Melee_macro-text"],r[l+"_val"]=a[t+"buff-Melee"],r[l+"_bonus"]="attack",r[l+"_bonustype"]="untyped",p=Va.without(p,"Melee","Ranged","CMB")),p.indexOf("Fort")>=0&&p.indexOf("Will")>=0&&p.indexOf("Ref")>=0&&parseInt(a[t+"buff-Fort"],10)===parseInt(a[t+"buff-Will"],10)===parseInt(a[t+"buff-Ref"],10)&&(c++,r[(l=o+c)+"-show"]=1,r[l+"_macro-text"]=a[t+"buff-Fort_macro-text"],r[l+"_val"]=a[t+"buff-Fort"],r[l+"_bonus"]="saves",r[l+"_bonustype"]="untyped",p=Va.without(p,"Fort","Will","Ref")),p.indexOf("Check")>=0&&p.indexOf("check_skills")>=0&&parseInt(a[t+"buff-Check"],10)===parseInt(a[t+"buff-check_skills"],10)&&(c++,r[(l=o+c)+"-show"]=1,r[l+"_macro-text"]=a[t+"buff-Check_macro-text"],r[l+"_val"]=a[t+"buff-Check"],r[l+"_bonus"]="check",r[l+"_bonustype"]="untyped",p=Va.without(p,"Check","check_skills")),p.indexOf("DMG")>=0&&p.indexOf("DMG_ranged")>=0&&parseInt(a[t+"buff-DMG"],10)===parseInt(a[t+"buff-DMG_ranged"],10)&&(c++,r[(l=o+c)+"_macro-text"]=a[t+"buff-DMG_macro-text"],r[l+"_val"]=a[t+"buff-DMG"],r[l+"_bonus"]="dmg",r[l+"_bonustype"]="untyped",r[l+"-show"]=1,p=Va.without(p,"DMG","DMG_ranged")),p.forEach((function(e){++c>6&&(c=1,i=generateRowID(),o=(s="repeating_buff2_"+i+"_")+"b",r[s+"enable_toggle"]=a[t+"buff-enable_toggle"],r[s+"name"]=a[t+"buff-name"]),r[(l=o+c)+"-show"]=1,r[l+"_macro-text"]=a[t+"buff-"+e+"_macro-text"],r[l+"_val"]=a[t+"buff-"+e]||0,"check"===(u=e.toLowerCase().replace("-",""))?u="check_ability":"dmg"===u&&(u="dmg_melee"),r[l+"_bonus"]=u,r[l+"_bonustype"]="untyped"})))}catch(t){n().error("Buff copy error for "+e+" "+(a["repeating_buff_"+e+"_buff-name"]||""),t)}})),Va.size(r)?(n().debug("##############################","MERGE BUFFS NEW BUFFS ARE: ",r),Ja(r,o.silentParams,t)):t()):t()}))}function cu(e,t,a){var n,r="repeating_buff2_"+gn(e),i="",s="",c=0,o="";try{a=a||{},t[r+"add_note_to_roll"]&&(s="buff_"+t[r+"add_note_to_roll"]+"_notes"),1===parseInt(t[r+"enable_toggle"],10)&&s&&(c=1),i="**"+Qa("buff")+": @{"+r+"name}:** @{"+r+"notes}",n=new RegExp(function(e,t){var a="";return e&&(a=e.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|\~\!\@\#]/g,"\\$&"),t&&(a=a.replace(/\t+|\s+/g,"\\s*"))),a}(i),"i"),s?((o=t[s]||"")?n.test(o)?c||(a[s]=o.replace(n,"")):c&&(a[s]=o+i):c&&(a[s]=i),eu.forEach((function(e){e!==s&&(o=t[e])&&(o=o.replace(n,""))!==t[e]&&(a[e]=o)}))):eu.forEach((function(e){(o=t[e])&&(o=o.replace(n,""))!==t[e]&&(a[e]=o)}))}catch(e){}finally{return a}}function ou(e,t){var a,n;(e||t)&&(a="repeating_buff2_"+gn(e=e||mn(t.sourceAttribute)),n=eu.concat([a+"add_note_to_roll",a+"enable_toggle"]),getAttrs(n,(function(t){var a=cu(e,t);Va.size(a)&&Ja(a,o.silentParams)})))}function lu(e,t){var a=function(){"function"==typeof e&&e()};getAttrs(Yl,(function(e){var n={},r={};n=Va.reduce(Xl,(function(t,a){var n=parseInt(e["buff_"+a+"-total"],10)||0,r=parseInt(e["buff_"+a+"_exists"],10)||0;return n&&(t["buff_"+a+"-total"]=0),r&&(t["buff_"+a+"_exists"]=0),t}),{}),n=Va.reduce(Do,(function(t,a){var n=parseInt(e["buff_"+a+"-total_penalty"],10)||0,r=parseInt(e["buff_"+a+"_penalty_exists"],10)||0;return n&&(t["buff_"+a+"-total_penalty"]=0),r&&(t["buff_"+a+"_penalty_exists"]=0),t}),n),eu.forEach((function(e){n[e]=""})),Va.size(n)?(t&&(r=o.silentParams),Ja(n,r,a)):a()}))}function uu(e,t,a){var r=[];return a&&(r=(r=Kl[a]||[]).concat($l[a]||[])),e.reduce((function(e,i){var s,c="repeating_buff2_"+i+"_";try{(s=tu.reduce((function(e,s){var o=c+s,l=o+"_bonus",u={};try{t[l]&&1===parseInt(t[o+"-show"],10)&&(!a||t[l]===a||r.indexOf(t[l])>=0)&&(u.bonus=t[l],u.val=parseInt(t[o+"_val"],10)||0,"size"===u.bonus?u.bonusType=u.bonus:"hptemp"===u.bonus?u.bonusType="untyped":Vl.indexOf(u.bonus)>=0?"enhancement"===t[o+"_bonustype"]?u.bonusType="enhancement":u.bonusType=u.bonus:u.bonusType=t[o+"_bonustype"]||"untyped",e.push(u))}catch(e){n().error("PFBuffs.assembleRows col:"+a+", row:"+i+", buff:"+s,e)}finally{return e}}),[]))&&Va.size(s)&&(e=e.concat(s))}catch(e){n().error("PFBuffs.assembleRows erri3:",e)}finally{return e}}),[])}function pu(e,t,a,r){var i=0,s={},c={sum:0,pen:0},o=0,l=0,u="",p=1,d=[e];try{if(r=r||{},i=Do.indexOf(e)>=0&&e.indexOf("skill")<9,Kl[e]&&(d=d.concat(Kl[e])),(t=t.filter((function(e){return d.indexOf(e.bonus)>=0?1:0})))&&Va.size(t)&&(n().debug("PFBUFFS ROWS NOW:",t),"hptemp"===e?c.sum=t.filter((function(e){return e.val>0})).reduce((function(e,t){return e+=t.val||0}),0):"size"===e?(c=t.reduce((function(e,t){return t.val>0?e.sum=Math.max(e.sum,t.val):t.val<0&&(e.pen=Math.min(e.pen,t.val)),e}),c)).sum+=c.pen:(s=t.reduce((function(t,a){return a.bonus===e&&(a.val<0?t.penalty=(t.penalty||0)+a.val:au.includes(a.bonusType)?t[a.bonusType]=(t[a.bonusType]||0)+a.val:t[a.bonusType]=Math.max(t[a.bonusType]||0,a.val)),t}),{}),Va.size(d)>1&&(s=t.reduce((function(t,a){return au.indexOf(a.bonusType)<0&&Kl[e].indexOf(a.bonus)>=0&&a.val>0&&t[a.bonusType]>0&&(a.val<t[a.bonusType]?t[a.bonusType]-=a.val:t[a.bonusType]=0),t}),s)),"armor"===e&&s.armor>0||"shield"===e&&s.shield>0?(n().debug("PFBUFFS ac bonsuses  ",s,Zl[e]),c.sum=Va.reduce(s,(function(e,t,a){return t>0&&(e+=t),e}),0),c.pen=Va.reduce(s,(function(e,t,a){return t<0&&(e+=t),e}),0),p=parseInt(a[e+"3-equipped"],10)||0,o=0,p&&(o=Va.reduce(Zl[e],(function(e,t,n){return e+=parseInt(a[t],10)||0}),0)),c.sum>0&&o>0&&(c.sum<=o?c.sum=0:c.sum>o&&(c.sum-=o)),0!==c.pen&&(c.sum+=c.pen)):(Va.each(Zl[e],(function(e,t){n().debug("PFBUFFS ################## type:"+t+", comparing to "+e),s[t]&&(o=parseInt(a[e],10)||0,s[t]<=o?s[t]=0:s[t]-=o)})),i&&Va.contains(s,"penalty")&&(c.pen=s.penalty,s.penalty=0),"ac"===e&&s.dodge&&("ac"===e&&(l+=s.dodge),s.dodge=0),c.sum=Va.reduce(s,(function(e,t,a){return e+=t}),0)))),"ac"===e&&(n().info("column is AC, setting dodge to "+l),l!==(parseInt(a["buff_dodge-total"],10)||0)&&(r["buff_dodge-total"]=l),o=parseInt(a.buff_dodge_exists,10)||0,l&&!o?r.buff_dodge_exists=1:o&&!l&&(r.buff_dodge_exists=0)),"cmd"===e&&0!==s.dodge){n().info("column is CMD, setting buffsFFcmdOnlyTemp to dodge buff:"+s.dodge);var f=s.dodge;r["buff_ffCMD-nododge"]=f||0,n().info("buff_ffCMD-nododge now set same as dodge buff:"+f)}(u=Gl[e])?(parseInt(a["buff_"+u+"-total"],10)!==c.sum&&(r["buff_"+u+"-total"]=c.sum),o=parseInt(a["buff_"+u+"_exists"],10)||0,0!==c.sum&&0===o?r["buff_"+u+"_exists"]=1:0===c.sum&&1===o&&(r["buff_"+u+"_exists"]=0),i&&(parseInt(a["buff_"+u+"-total_penalty"],10)!==c.pen&&(r["buff_"+u+"-total_penalty"]=c.pen),o=parseInt(a["buff_"+u+"_penalty_exists"],10)||0,0!==c.pen&&0===o?r["buff_"+u+"_penalty_exists"]=1:0===c.pen&&1===o&&(r["buff_"+u+"_penalty_exists"]=0))):n().error("PFBuffs.updateBuffTotal cannot find total column corresponding to "+e)}catch(e){n().error("PFBuffs.updateBuffTotal",e)}finally{return n().debug("######################","PFBuffs setting ",r),r}}function du(e,t,a){var r=Va.once((function(){"function"==typeof t&&t()})),i=Do.indexOf(e)>=0&&e.indexOf("skill")<0;getSectionIDs("repeating_buff2",(function(s){var c,l,u,p=[],d=[],f=[];if(s&&Va.size(s)){try{c=bn(["repeating_buff2_"],s,ru),d=[e],f=[e],$l[e]&&(d=d.concat($l[e]),f=f.concat($l[e])),Kl[e]&&(d=d.concat(Kl[e])),p=f.map((function(e){return Gl[e]})),"ac"===e&&p.push("dodge"),l=p.map((function(e){return"buff_"+e+"-total"})).concat(p.map((function(e){return"buff_"+e+"_exists"}))),i&&(l=l.concat(["buff_"+Gl[e]+"-total_penalty","buff_"+Gl[e]+"_penalty_exists"])),c=(c=c.concat(l)).concat(eu),u=d.reduce((function(e,t){return Zl[t]&&Va.each(Zl[t],(function(t,a){e.push(t)})),e}),[]),Va.size(u)&&(c=c.concat(u)),"armor"===e?c.push("armor3-equipped"):"shield"===e&&c.push("shield3-equipped")}catch(t){return n().error("PFBUffs.updateBuffTotalAsync2 "+e+" error before getAttrs",t),void r()}getAttrs(c,(function(t){var i,c={},l={},u=0;try{s=s.filter((function(e){return parseInt(t["repeating_buff2_"+e+"_enable_toggle"],10)||0})),Va.size(s)?(i=uu(s,t,e),l=f.reduce((function(e,a){return pu(a,i,t,e)}),l)):lu()}catch(t){n().error("PFBuffs.updateBuffTotalAsync errou on col "+e,t)}finally{Va.size(l)?(a&&(c=o.silentParams),Va.each(l,(function(e,a){if(iu.buffEventsTotalOnUpdate[a]){var n=parseInt(t[a],10)||0;u+=parseInt(e,10)-n}})),u&&Ci(u,0),Ja(l,c,r)):r()}}))}else lu(t)}))}function fu(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));getSectionIDs("repeating_buff2",(function(e){var a;e&&0!==Va.size(e)?(a=(a=(a=(a=bn(["repeating_buff2_"],e,ru)).concat(Yl)).concat(Ql)).concat(["armor3-equipped","shield3-equipped"]),getAttrs(a,(function(a){var i=[],s={},c={};try{if(!(e=e.filter((function(e){return parseInt(a["repeating_buff2_"+e+"_enable_toggle"],10)||0})))||0===Va.size(e))return void lu(r,t);eu.forEach((function(e){c[e]="",a[e]=""})),c=e.reduce((function(e,t){return e=cu(t,a,e),a=Va.extend(a,e),e}),c),i=uu(e,a),Va.each(Wl,(function(e){c=pu(e,i,a,c)}))}catch(e){n().error("PFBuffs.updateAllBuffTotalsAsync2 errou on col ",e)}finally{Va.size(c)?(t&&(s=o.silentParams),Ja(c,s,r)):r()}}))):lu(r,t)}))}function mu(e,t){var a=Va.once((function(){"function"==typeof e&&e()})),r=["_b1-show","_b1_val","_b1_macro-text","_b2-show","_b2_val","_b2_macro-text","_b3-show","_b3_val","_b3_macro-text","_b4-show","_b4_val","_b4_macro-text","_b5-show","_b5_val","_b5_macro-text","_b6-show","_b6_val","_b6_macro-text","_enable_toggle"];getSectionIDs("repeating_buff",(function(e){var t;try{Va.size(e)>0?(t=bn(["repeating_buff2_"],e,r),getAttrs(t,(function(t){var r=Va.size(e),i=Va.after(r,a);e.forEach((function(e){!function(e,t,a){var r=Va.after(6,e);try{tu.forEach((function(e){parseInt(a["repeating_buff2_"+t+"_enable_toggle"],10)&&parseInt(a["repeating_buff2_"+t+"_"+e+"-show"],10)?an("repeating_buff2_"+t+"_"+e+"_macro-text","repeating_buff2_"+t+"_"+e+"_val",0,r,!0):r()}))}catch(e){n().error("PFBuffs.reEvaluateCustomMacros2:  rowid"+t,e),r()}}(i,e,t)}))}))):lu(a)}catch(e){n().error("PFBuffs.reEvaluateCustomMacros2",e),a()}}))}function _u(e,t){var a={};getAttrs(["add_common_buff","common_buff_toadd","CON-mod","level","speed-base"],(function(e){var r=0;n().debug("adding common buff:",e),parseInt(e.add_common_buff,10)&&(e.common_buff_toadd&&(t&&"player"===t.sourceType&&(r=1),a=function(e,t,a){var n,r={},i=0,s=0,c=0,o=0,l=0,u=0;if(!e)return r;switch(r[(n="repeating_buff2_"+generateRowID()+"_")+"enable_toggle"]=a?1:0,r[n+"tabcat2"]="1",t&&(s=parseInt(t["CON-mod"],10),c=parseInt(t["speed-base"],10),o=parseInt(t.level,10),u=parseInt(t.bab,10),isNaN(s)||isNaN(c)||isNaN(o)||isNaN(u)||(i=1)),e){case"rage":r[n+"name"]=Qa("buff-rage"),r[n+"bufftype"]="class",r[n+"tabcat"]="class",r[n+"b1-show"]=1,r[n+"b1_bonus"]="str",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="4 + min(4,2*(floor(@{level}/11)+floor(@{level}/20)))",l=1===i?o<11?4:20===o?8:6:4,r[n+"b1_val"]=l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="con",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="4 + min(4,2*(floor(@{level}/11)+floor(@{level}/20)))",r[n+"b2_val"]=l,r[n+"b3-show"]=1,r[n+"b3_bonus"]="ac",r[n+"b3_bonustype"]="untyped",r[n+"b3_macro-text"]="-2",r[n+"b3_val"]=-2,r[n+"b4-show"]=1,r[n+"b4_bonus"]="will",r[n+"b4_bonustype"]="morale",r[n+"b4_macro-text"]="2 + min(4,(floor(@{level}/11)+floor(@{level}/20)))",l/=2,r[n+"b4_val"]=l,r[n+"add_note_to_roll"]="skill",r[n+"notes"]=Qa("buff-rage-note"),r[n+"description-show"]=1;break;case"unchainedrage":r[n+"name"]=Qa("buff-rage-unchained"),r[n+"bufftype"]="class",r[n+"tabcat"]="class",r[n+"b1-show"]=1,r[n+"b1_bonus"]="melee",r[n+"b1_bonustype"]="untyped",r[n+"b1_macro-text"]="2 + min(2,(floor(@{level}/11)+floor(@{level}/20)))",l=1===i?o<11?2:20===o?4:3:2,r[n+"b1_val"]=l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg_melee",r[n+"b2_bonustype"]="untyped",r[n+"b2_macro-text"]="2 + min(2,(floor(@{level}/11)+floor(@{level}/20)))",r[n+"b2_val"]=l,r[n+"b3-show"]=1,r[n+"b3_bonus"]="ac",r[n+"b3_bonustype"]="untyped",r[n+"b3_macro-text"]="-2",r[n+"b3_val"]=-2,r[n+"b4-show"]=1,r[n+"b4_bonus"]="will",r[n+"b4_bonustype"]="untyped",r[n+"b4_macro-text"]="2 + min(2,(floor(@{level}/11)+floor(@{level}/20)))",r[n+"b4_val"]=l,r[n+"b5-show"]=1,r[n+"b5_bonus"]="hptemp",r[n+"b5_hide"]=1,r[n+"b5_macro-text"]="@{level}*(2+(floor(@{level}/11)+floor(@{level}/20)))",l*=o,r[n+"b5_val"]=l,r[n+"add_note_to_roll"]="skill",r[n+"notes"]=Qa("buff-rage-note"),r[n+"description-show"]=1;break;case"prayer":r[n+"name"]=Qa("buff-prayer"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="luck",r[n+"b1_macro-text"]="1",r[n+"b1_val"]=1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_bonustype"]="luck",r[n+"b2_macro-text"]="1",r[n+"b2_val"]=1,r[n+"b3-show"]=1,r[n+"b3_bonus"]="saves",r[n+"b3_bonustype"]="luck",r[n+"b3_macro-text"]="1",r[n+"b3_val"]=1,r[n+"b4-show"]=1,r[n+"b4_bonus"]="check_skills",r[n+"b4_bonustype"]="luck",r[n+"b4_macro-text"]="1",r[n+"b4_val"]=1;break;case"prayerdebuff":r[n+"name"]=Qa("buff-prayer-debuff"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="luck",r[n+"b1_macro-text"]="-1",r[n+"b1_val"]=-1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_bonustype"]="luck",r[n+"b2_macro-text"]="-1",r[n+"b2_val"]=-1,r[n+"b3-show"]=1,r[n+"b3_bonus"]="saves",r[n+"b3_bonustype"]="luck",r[n+"b3_macro-text"]="-1",r[n+"b3_val"]=-1,r[n+"b4-show"]=1,r[n+"b4_bonus"]="check_skills",r[n+"b4_bonustype"]="luck",r[n+"b4_macro-text"]="-1",r[n+"b4_val"]=-1;break;case"bless":r[n+"name"]=Qa("buff-bless"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="1",r[n+"b1_val"]=1,r[n+"b2-show"]=0,r[n+"b2_bonus"]="will",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="1",r[n+"b2_val"]=1,r[n+"add_note_to_roll"]="save",r[n+"notes"]=Qa("buff-bless-note"),r[n+"description-show"]=1;break;case"aid":r[n+"name"]=Qa("buff-aid"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="1",r[n+"b2-show"]=0,r[n+"b2_bonus"]="will",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="2",r[n+"b2_val"]=2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="hptemp",r[n+"b3_hide"]=1,r[n+"b3_val_error"]=1,r[n+"b3_macro-text"]="1d8 + @{level}",l=i?4+o:4,r[n+"b3_val"]=l,r[n+"add_note_to_roll"]="save",r[n+"notes"]=Qa("buff-aid-note"),r[n+"description-show"]=1;break;case"haste":r[n+"name"]=Qa("buff-haste"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="untyped",r[n+"b1_macro-text"]="1",r[n+"b1_val"]=1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="ac",r[n+"b2_bonustype"]="dodge",r[n+"b2_macro-text"]="1",r[n+"b2_val"]=1,r[n+"b3-show"]=1,r[n+"b3_bonus"]="ref",r[n+"b3_bonustype"]="dodge",r[n+"b3_macro-text"]="1",r[n+"b3_val"]=1,r[n+"b4-show"]=1,r[n+"b4_bonus"]="speed",r[n+"b4_bonustype"]="enhancement",r[n+"b4_macro-text"]="min(@{speed-base},30)",l=30,i&&c<30&&(l=c),r[n+"b4_val"]=l,r[n+"add_note_to_roll"]="attack",r[n+"notes"]=Qa("buff-haste-note"),r[n+"description-show"]=1;break;case"enlargeperson":r[n+"name"]=Qa("buff-enlarge-person"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="size",r[n+"b1_hide"]=1,r[n+"b1_macro-text"]="1",r[n+"b1_val"]=1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="str",r[n+"b2_bonustype"]="size",r[n+"b2_macro-text"]="2",r[n+"b2_val"]=2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="dex",r[n+"b3_bonustype"]="size",r[n+"b3_macro-text"]="-2",r[n+"b3_val"]=-2,r[n+"notes"]=Qa("buff-enlarge-person-note");break;case"divinefavor":r[n+"name"]=Qa("buff-divine-favor"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="luck",r[n+"b1_macro-text"]="min(3, max(1, floor(@{level}/3)))",l=1,i&&(l=o<=5?1:o<=8?2:3),r[n+"b1_val"]=l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_bonustype"]="luck",r[n+"b2_macro-text"]="min(3, max(1, floor(@{level}/3)))",r[n+"b2_val"]=l;break;case"shieldoffaith":r[n+"name"]=Qa("buff-shield-of-faith"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="ac",r[n+"b1_bonustype"]="deflection",r[n+"b1_macro-text"]="2+floor((@{level})/6)",l=2,i&&(l=o<6?2:o<12?3:o<18?4:5),r[n+"b1_val"]=l;break;case"shield":r[n+"name"]=Qa("buff-shield"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="shield",r[n+"b1_bonustype"]="shield",r[n+"b1_macro-text"]="4",r[n+"b1_val"]=4,r[n+"add_note_to_roll"]="defense",r[n+"notes"]=Qa("buff-shield-note"),r[n+"description-show"]=1;break;case"magearmor":r[n+"name"]=Qa("buff-mage-armor"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="armor",r[n+"b1_bonustype"]="armor",r[n+"b1_macro-text"]="4",r[n+"b1_val"]=4,r[n+"add_note_to_roll"]="defense",r[n+"notes"]=Qa("buff-magearmor-note"),r[n+"description-show"]=1;break;case"inspirecourage":r[n+"name"]=Qa("buff-inspire-courage"),r[n+"bufftype"]="song",r[n+"tabcat"]="song",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="competence",r[n+"b1_macro-text"]="1+floor((@{level}+1)/6)",l=1,i&&(l=o<5?1:o<11?2:o<16?3:4),r[n+"b1_val"]=l,r[n+"b3-show"]=1,r[n+"b3_bonus"]="dmg",r[n+"b3_bonustype"]="competence",r[n+"b3_macro-text"]="1+floor((@{level}+1)/6)",r[n+"b3_val"]=l,r[n+"b2-show"]=0,r[n+"b2_bonus"]="will",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="1+floor((@{level}+1)/6)",r[n+"b2_val"]=l,r[n+"add_note_to_roll"]="save",r[n+"notes"]=Qa("buff-inspire-courage-note"),r[n+"description-show"]=1;break;case"inspiregreatness":r[n+"name"]=Qa("buff-inspire-greatness"),r[n+"bufftype"]="song",r[n+"tabcat"]="song",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="competence",r[n+"b1_macro-text"]="2",r[n+"b1_val"]=2,r[n+"b2-show"]=1,r[n+"b2_bonus"]="fort",r[n+"b2_bonustype"]="competence",r[n+"b2_macro-text"]="2",r[n+"b2_val"]=2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="hptemp",r[n+"b3_hide"]=1,r[n+"b3_macro-text"]="2d10+(2*@{CON-mod})",l=10,i&&(l=10+2*s),r[n+"b3_val"]=l,r[n+"b3_val_error"]=1,r[n+"b4-show"]=1,r[n+"b4_bonus"]="casterlevel",r[n+"b4_bonustype"]="untyped",r[n+"b4_macro-text"]="2",r[n+"b4_val"]=2;break;case"inspireheroics":r[n+"name"]=Qa("buff-inspire-heroics"),r[n+"bufftype"]="song",r[n+"tabcat"]="song",r[n+"b1-show"]=1,r[n+"b1_bonus"]="saves",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="4",r[n+"b1_val"]=4,r[n+"b2-show"]=1,r[n+"b2_bonus"]="ac",r[n+"b2_bonustype"]="dodge",r[n+"b2_macro-text"]="4",r[n+"b2_val"]=4;break;case"inspiredrage":r[n+"name"]=Qa("buff-inspired-rage"),r[n+"bufftype"]="song",r[n+"tabcat"]="song",r[n+"b1-show"]=1,r[n+"b1_bonus"]="str",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="2+(2*floor(@{level}/8))",l=2,i&&(l=o<8?2:o<16?4:6),r[n+"b1_val"]=l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="con",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="2+(2*floor(@{level}/8))",r[n+"b2_val"]=l,r[n+"b3-show"]=1,r[n+"b3_bonus"]="ac",r[n+"b3_bonustype"]="untyped",r[n+"b3_macro-text"]="-1",r[n+"b3_val"]=-1,r[n+"b4-show"]=1,r[n+"b4_bonus"]="will",r[n+"b4_bonustype"]="morale",r[n+"b4_macro-text"]="1+floor(@{level}/4)",l=1,i&&(l=1+Math.floor(o/4)),r[n+"b4_val"]=l,r[n+"add_note_to_roll"]="skill",r[n+"notes"]=Qa("buff-inspired-rage-note"),r[n+"description-show"]=1;break;case"heroism":r[n+"name"]=Qa("buff-heroism"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="2",r[n+"b1_val"]=2,r[n+"b2-show"]=1,r[n+"b2_bonus"]="saves",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="2",r[n+"b2_val"]=2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="check_skills",r[n+"b3_bonustype"]="morale",r[n+"b3_macro-text"]="2",r[n+"b3_val"]=2;break;case"blessingoffervor":r[n+"name"]=Qa("buff-blessing-of-fervor"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="untyped",r[n+"b1_macro-text"]="2",r[n+"b1_val"]=2,r[n+"b2-show"]=1,r[n+"b2_bonus"]="ac",r[n+"b2_bonustype"]="dodge",r[n+"b2_macro-text"]="2",r[n+"b2_val"]=2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="ref",r[n+"b3_bonustype"]="dodge",r[n+"b3_macro-text"]="2",r[n+"b3_val"]=2,r[n+"b4-show"]=1,r[n+"b4_bonus"]="speed",r[n+"b4_bonustype"]="enhancement",r[n+"b4_macro-text"]="30",r[n+"b4_val"]=30,r[n+"notes"]=Qa("buff-blessing-of-fervor-note"),r[n+"description-show"]=1;break;case"goodhope":r[n+"name"]=Qa("buff-good-hope"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="2",r[n+"b1_val"]=2,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="2",r[n+"b2_val"]=2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="saves",r[n+"b3_bonustype"]="morale",r[n+"b3_macro-text"]="2",r[n+"b3_val"]=2,r[n+"b4-show"]=1,r[n+"b4_bonus"]="check",r[n+"b4_bonustype"]="morale",r[n+"b4_macro-text"]="2",r[n+"b4_val"]=2;break;case"crushingdespair":r[n+"name"]=Qa("buff-crushing-despair"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_macro-text"]="-2",r[n+"b1_val"]=-2,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_macro-text"]="-2",r[n+"b2_val"]=-2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="saves",r[n+"b3_macro-text"]="-2",r[n+"b3_val"]=-2,r[n+"b4-show"]=1,r[n+"b4_bonus"]="check",r[n+"b4_macro-text"]="-2",r[n+"b4_val"]=-2;break;case"archonsaura":r[n+"name"]=Qa("buff-archons-aura"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_macro-text"]="-2",r[n+"b1_val"]=-2,r[n+"b2-show"]=1,r[n+"b2_bonus"]="saves",r[n+"b2_macro-text"]="-2",r[n+"b2_val"]=-2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="ac",r[n+"b3_macro-text"]="-2",r[n+"b3_val"]=-2,r[n+"add_note_to_roll"]="defense",r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-archons-aura-note");break;case"curse":r[n+"name"]=Qa("buff-curse"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="str",r[n+"b1_macro-text"]="-6",r[n+"b1_val"]=-6,r[n+"b2-show"]=1,r[n+"b2_bonus"]="attack",r[n+"b2_macro-text"]="-4",r[n+"b2_val"]=-4,r[n+"b2-show"]=1,r[n+"b2_bonus"]="saves",r[n+"b2_macro-text"]="-4",r[n+"b2_val"]=-4,r[n+"b2-show"]=1,r[n+"b2_bonus"]="check",r[n+"b2_macro-text"]="-4",r[n+"b2_val"]=-4,r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-curse-note");break;case"desecrate":r[n+"name"]=Qa("buff-desecrate"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="profane",r[n+"b1_macro-text"]="1",r[n+"b1_val"]=1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_bonustype"]="profane",r[n+"b2_macro-text"]="1",r[n+"b2_val"]=1,r[n+"b3-show"]=1,r[n+"b3_bonus"]="saves",r[n+"b3_bonustype"]="profane",r[n+"b3_macro-text"]="1",r[n+"b3_val"]=1,r[n+"add_note_to_roll"]="save",r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-desecrate-note");break;case"consecrate":r[n+"name"]=Qa("buff-consecrate"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_macro-text"]="-1",r[n+"b1_val"]=-1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_macro-text"]="-1",r[n+"b2_val"]=-1,r[n+"b3-show"]=1,r[n+"b3_bonus"]="saves",r[n+"b3_macro-text"]="-1",r[n+"b3_val"]=-1,r[n+"add_note_to_roll"]="save",r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-consecrate-note");break;case"slow":r[n+"name"]=Qa("buff-slow"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_macro-text"]="-1",r[n+"b1_val"]=-1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="ac",r[n+"b2_macro-text"]="-1",r[n+"b2_val"]=-1,r[n+"b3-show"]=1,r[n+"b3_bonus"]="ref",r[n+"b3_macro-text"]="-1",r[n+"b3_val"]=-1,r[n+"b4-show"]=1,r[n+"b3_bonus"]="speed",r[n+"b3_macro-text"]="-ceil(ceil(@{speed-base}/2)/5)*5",r[n+"b3_val"]=-15,r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-slow-note");break;case"reduceperson":r[n+"name"]=Qa("buff-reduce-person"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="size",r[n+"b1_hide"]=1,r[n+"b1_macro-text"]="-1",r[n+"b1_val"]=-1,r[n+"b2-show"]=1,r[n+"b2_bonus"]="str",r[n+"b2_bonustype"]="size",r[n+"b2_macro-text"]="-2",r[n+"b2_val"]=-2,r[n+"b3-show"]=1,r[n+"b3_bonus"]="dex",r[n+"b3_bonustype"]="size",r[n+"b3_macro-text"]="+2",r[n+"b3_val"]=2,r[n+"notes"]=Qa("buff-reduce-person-note");break;case"bane":r[n+"name"]=Qa("buff-bane"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_macro-text"]="-1",r[n+"b1_val"]=-1,r[n+"b2-show"]=0,r[n+"b2_bonus"]="will",r[n+"b2_macro-text"]="-1",r[n+"b2_val"]=-1,r[n+"add_note_to_roll"]="save",r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-bane-note");break;case"deathknell":r[n+"name"]=Qa("buff-death-knell"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="str",r[n+"b1_bonustype"]="enhancement",r[n+"b1_macro-text"]="2",r[n+"b1_val"]=2,r[n+"b2-show"]=1,r[n+"b2_bonus"]="casterlevel",r[n+"b2_bonustype"]="untyped",r[n+"b2_macro-text"]="1",r[n+"b2_val"]=1,r[n+"b3-show"]=1,r[n+"b3_bonus"]="hptemp",r[n+"b3_hide"]=1,r[n+"b3_macro-text"]="1d8",r[n+"b3_val"]=4,r[n+"b3_val_error"]=1,r[n+"description-show"]="1",r[n+"notes"]="roll 1d8 and place in temp hp macro textbox";break;case"magicvestment":r[n+"name"]=Qa("buff-magic-vestment"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="armor",r[n+"b1_bonustype"]="enhancement",r[n+"b1_macro-text"]="min(5,floor(@{level}/4))",l=1,i&&(l=1+Math.floor(o/8)),r[n+"b1_val"]=l,r[n+"description-show"]="1",r[n+"notes"]="Can change bonus to shield";break;case"ward":r[n+"name"]=Qa("buff-ward"),r[n+"bufftype"]="hex",r[n+"tabcat"]="hex",r[n+"b1-show"]=1,r[n+"b1_bonus"]="ac",r[n+"b1_bonustype"]="deflection",r[n+"b1_macro-text"]="2 + (floor(@{level}/8))",l=2,i&&(l=2+Math.floor(o/8)),r[n+"b1_val"]=l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="saves",r[n+"b2_bonustype"]="resistance",r[n+"b2_macro-text"]="2 + (floor(@{level}/8))",r[n+"b2_val"]=l,r[n+"add_note_to_roll"]="save",r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-ward-note");break;case"battlespirit":r[n+"name"]=Qa("buff-battle-spirit"),r[n+"bufftype"]="aura",r[n+"tabcat"]="aura",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_bonustype"]="morale",r[n+"b1_macro-text"]="1 + (floor(@{level}/8))",l=1,i&&(l=1+Math.floor(o/8)),r[n+"b1_val"]=l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg",r[n+"b2_bonustype"]="morale",r[n+"b2_macro-text"]="1 + (floor(@{level}/8))",r[n+"b2_val"]=l;break;case"battleward":r[n+"name"]=Qa("buff-battle-ward"),r[n+"bufftype"]="hex",r[n+"tabcat"]="hex",r[n+"b1-show"]=1,r[n+"b1_bonus"]="ac",r[n+"b1_bonustype"]="deflection",r[n+"b1_macro-text"]="3 + (floor(@{level}/8))",l=3,i&&(l=3+Math.floor(o/8)),r[n+"b1_val"]=l,r[n+"add_note_to_roll"]="defense",r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-battle-ward-note");break;case"hamperinghex":r[n+"name"]=Qa("buff-hampering-hex"),r[n+"bufftype"]="hex",r[n+"tabcat"]="hex",r[n+"b1-show"]=1,r[n+"b1_bonus"]="ac",r[n+"b1_macro-text"]="-2",r[n+"b1_val"]=-2,r[n+"notes"]="At 8th level the penalty becomes -4";break;case"boneward":r[n+"name"]=Qa("buff-bone-ward"),r[n+"bufftype"]="hex",r[n+"tabcat"]="hex",r[n+"b1-show"]=1,r[n+"b1_bonus"]="ac",r[n+"b1_bonustype"]="deflection",r[n+"b1_macro-text"]="2 + (floor(@{level}/8))",l=2,i&&(l=2+Math.floor(o/8)),r[n+"b1_val"]=l;break;case"stardust":r[n+"name"]=Qa("buff-stardust"),r[n+"bufftype"]="spell",r[n+"tabcat"]="spell",r[n+"b1-show"]=1,r[n+"b1_bonus"]="attack",r[n+"b1_macro-text"]="-1 - (floor(@{level}/4))",l=-1,i&&(l=-1*(1+Math.floor(o/4))),r[n+"b1_val"]=l,r[n+"add_note_to_roll"]="skill",r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-stardust-note");break;case"airbarrier":r[n+"name"]=Qa("buff-air-barrier"),r[n+"bufftype"]="hex",r[n+"tabcat"]="hex",r[n+"b1-show"]=1,r[n+"b1_bonus"]="armor",r[n+"b1_bonustype"]="armor",r[n+"b1_macro-text"]="4 + (2*(floor (max((@{level}-3),0) /4)))",l=4,i&&(o<7?l=4:l<11?l=6:l<15?l=8:l<19&&(l=10)),r[n+"b1_val"]=l,r[n+"description-show"]="1",r[n+"notes"]=Qa("buff-air-barrier-note");break;case"elementaloverflow":r[n+"name"]=Qa("buff-elemental-overflow"),r[n+"bufftype"]="class",r[n+"tabcat"]="class",r[n+"b1-show"]=1,r[n+"b1_bonus"]="kineticblast",r[n+"b1_bonustype"]="untyped",r[n+"b1_macro-text"]="min(@{kineticistburn},max(0,floor(@{kineticist_level-mod}/3)))",r[n+"b1_val"]=0,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg_kineticblast",r[n+"b2_bonustype"]="untyped",r[n+"b2_macro-text"]="2*min(@{kineticistburn},max(0,floor(@{kineticist_level-mod}/3)))",r[n+"b2_val"]=0,r[n+"b3-show"]=1,r[n+"b3_bonus"]="dex",r[n+"b3_bonustype"]="size",r[n+"b3_macro-text"]="min(3,max(0,floor((@{kineticistburn}-1)/2)),floor((@{kineticist_level-mod}-1)/5))*2",r[n+"b3_val"]=0,r[n+"b4-show"]=1,r[n+"b4_bonus"]="con",r[n+"b4_bonustype"]="size",r[n+"b4_macro-text"]="min(2,max(0,floor((@{kineticistburn}+1)/4)),floor((@{kineticist_level-mod}+4)/10))*2",r[n+"b4_val"]=0,r[n+"b5-show"]=1,r[n+"b5_bonus"]="str",r[n+"b5_bonustype"]="size",r[n+"b5_macro-text"]="min(1,max(0,floor(@{kineticistburn}/5)),floor(@{kineticist_level-mod}/11))*2",r[n+"b5_val"]=0,r[n+"description-show"]="1",r[n+"add_note_to_roll"]="defense",r[n+"notes"]="**:"+Qa("buff-elemental-overflow")+"** [[({1d1,{1d0,(@{kineticist_level-mod}-2)d1}kh1}kl1)*5*@{kineticistburn}]]**%** "+Qa("buff-elemental-overflow-note");break;case"powerattack":r[n+"name"]=Qa("buff-power-attack"),r[n+"bufftype"]="other",r[n+"tabcat"]="other",r[n+"b1-show"]=1,r[n+"b1_bonus"]="melee",r[n+"b1_bonustype"]="untyped",r[n+"b1_macro-text"]="-1-floor(@{bab}/4)",l=1,i&&(l=1+Math.floor(u/4)),r[n+"b1_val"]=-l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg_power_attack",r[n+"b2_bonustype"]="untyped",r[n+"b2_macro-text"]="2+2*floor(@{bab}/4)",r[n+"b2_val"]=2*l,r[n+"notes"]=Qa("buff-power-attack-note");break;case"deadlyaim":r[n+"name"]=Qa("buff-deadly-aim"),r[n+"bufftype"]="other",r[n+"tabcat"]="other",r[n+"b1-show"]=1,r[n+"b1_bonus"]="ranged",r[n+"b1_bonustype"]="untyped",r[n+"b1_macro-text"]="-1-floor(@{bab}/4)",l=1,i&&(l=1+Math.floor(u/4)),r[n+"b1_val"]=-l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="dmg_ranged",r[n+"b2_bonustype"]="untyped",r[n+"b2_macro-text"]="2+2*floor(@{bab}/4)",r[n+"b2_val"]=2*l,r[n+"notes"]=Qa("buff-deadly-aim-note");break;case"combatexpertise":r[n+"name"]=Qa("buff-combat-expertise"),r[n+"bufftype"]="other",r[n+"tabcat"]="other",r[n+"b1-show"]=1,r[n+"b1_bonus"]="melee",r[n+"b1_bonustype"]="untyped",r[n+"b1_macro-text"]="-1-floor(@{bab}/4)",l=1,i&&(l=1+Math.floor(u/4)),r[n+"b1_val"]=-l,r[n+"b2-show"]=1,r[n+"b2_bonus"]="ac",r[n+"b2_bonustype"]="dodge",r[n+"b2_macro-text"]="1+floor(@{bab}/4)",r[n+"b2_val"]=2*l,r[n+"notes"]=Qa("buff-combat-expertise-note")}return r}(e.common_buff_toadd,e,r),a.common_buff_toadd="","slow"===e.common_buff_toadd&&(a["condition-Staggered"]=1)),a.add_common_buff=0,Ja(a,o.silentParams,fu))}))}function gu(e){Ul(e)}var bu=n().callback((function(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()}));gu((function(){getAttrs(["is_newsheet","use_buff_bonuses"],(function(e){parseInt(e.is_newsheet,10)?r():parseInt(e.use_buff_bonuses,10)?mu((function(){fu((function(){!function(e){var t=Va.once((function(){"function"==typeof e&&e()}));getAttrs(Yl,(function(e){var a={},r=function(t,a){var n,r;return a=a||"",n=parseInt(e[t+"-total"+a],10)||0,r=parseInt(e[t+a+"_exists"],10)||0,0===n||r?0===n&&r?0:-1:1};try{a=Va.reduce(Xl,(function(e,t){var a,n;return 1!==(n=r(a="buff_"+t,""))&&0!==n||(e[a+"_exists"]=n),e}),a),a=Va.reduce(Do,(function(e,t){var a,n;return 1!==(n=r(a="buff_"+t,"_penalty"))&&0!==n||(e[a+"_penalty_exists"]=n),e}),a)}catch(e){n().error("PFBuffs.resetStatuspanel2 error inside calculate exists",e)}finally{Va.size(a)>0?Ja(a,o.silentParams,t):t()}}))}(),r()}),t)})):jl(r,t)}))}))}));function hu(e,t){getAttrs(["customd1","customd2","customd3","customd4","customd5","customd6","customd1-name","customd2-name","customd3-name","customd4-name","customd5-name","customd6-name","allcustom_macro","NPC-allcustom_macro"],(function(t){var a="",r="",i="";try{t.customd1&&(a+=(i="["+(fn(t["customd1-name"])||"customd1")+"](~@{character_id}|")+"customd1_roll) ",r+=i+"NPC-customd1_roll) "),t.customd2&&(a+=(i="["+(fn(t["customd2-name"])||"customd2")+"](~@{character_id}|")+"customd2_roll) ",r+=i+"NPC-customd2_roll) "),t.customd3&&(a+=(i="["+(fn(t["customd3-name"])||"customd3")+"](~@{character_id}|")+"customd3_roll) ",r+=i+"NPC-customd3_roll) "),t.customd4&&(a+=(i="["+(fn(t["customd4-name"])||"customd4")+"](~@{character_id}|")+"customd4_roll) ",r+=i+"NPC-customd4_roll) "),t.customd5&&(a+=(i="["+(fn(t["customd5-name"])||"customd5")+"](~@{character_id}|")+"customd5_roll) ",r+=i+"NPC-customd5_roll) "),t.customd6&&(a+=(i="["+(fn(t["customd6-name"])||"customd6")+"](~@{character_id}|")+"customd6_roll) ",r+=i+"NPC-customd6_roll) "),(a||r)&&(a="{{roll20=^{custom}}} {{roll21="+a+" }}",r="{{roll20=^{custom}}} {{roll21="+r+" }}")}catch(e){n().error("PFCustom.resetCommandMacro ",e)}finally{a!==t.allcustom_macro||r!==t["NPC-allcustom_macro"]?Ja({allcustom_macro:a,"NPC-allcustom_macro":r},o.silentParams,e):"function"==typeof e&&e()}}))}function yu(e,t){var a=Va.once((function(){"function"==typeof e&&e()})),r=Va.after(4,(function(){setAttrs({migrated_ability_dropdowns4:1},o.silentParams,a)}));getAttrs(["migrated_ability_dropdowns4"],(function(e){var t,i,s;parseInt(e.migrated_ability_dropdowns4,10)?a():(getSectionIDs("repeating_weapon",(function(e){var t;e&&0!==Va.size(e)?(t=bn(["repeating_weapon_"],e,["_damage-ability"]),getAttrs(t,(function(e){var t;try{t=Object.keys(e).reduce((function(t,a){var n="";return e[a]&&"0"!==e[a]&&(n=e[a].replace("@{","").replace("}",""))!==e[a]&&(t[a]=n),t}),{})}catch(e){n().error("PFSheet.migrate repeating ability dropdowns ",e)}finally{Va.size(t)?(n().debug("Migrate repeatingweapon ability dropdowns setting:",t),setAttrs(t,o.silentParams,r)):r()}}))):r()})),s=Object.keys(o.abilityScoreManualDropdowns),getAttrs(s,(function(e){var t={};try{t=s.reduce((function(t,a){var n="";if(e[a])switch(a){case"concentration-0-ability":case"concentration-1-ability":case"concentration-2-ability":case"FF-ability":case"CMD-ability":case"sanity-ability":case"selected-ability-psionic-power":case"melee2-ability":case"ranged2-ability":case"cmb2-ability":n=vn(e[a])||"0";break;default:n=vn(e[a])}return!n&&o.manualDropdownDefaults[a]&&(n=o.manualDropdownDefaults[a]),n&&n!==e[a]&&(t[a]=n),t}),{})}catch(e){n().error("PFSheet.migrate AbilityModDropdowns ",e)}finally{Va.size(t)?(n().debug("Migrate ability dropdowns setting:",t),setAttrs(t,o.silentParams,r)):r()}})),t=Object.keys(o.repeatingAttackTypeManualDropdowns),Va.size(t)?(i=Va.after(Va.size(t),r),t.forEach((function(e){getSectionIDs("repeating_"+e,(function(t){var a,r;if(!t||0===Va.size(t))return n().warn("migrate repeating attacktype Dropdowns, there are no rows for "+e),void i();r="_"+o.repeatingAttackTypeManualDropdowns[e],a=t.map((function(t){return"repeating_"+e+"_"+t+r})),getAttrs(a,(function(t){var a,r="";a=Object.keys(t).reduce((function(a,i){try{t[i]&&"0"!==t[i][0]&&(r=t[i].replace("@{","").replace("}",""))!==t[i]&&(a[i]=r)}catch(t){n().error("PFSheet.migrate repeating attacktype dropdowns for: "+e,t)}finally{return a}}),{}),Va.size(a)>0?(n().debug("Migrate attack dropdowns setting:",a),setAttrs(a,o.silentParams,i)):i()}))}))}))):r(),function(){var e=ui.map((function(e){return e+"-ability"}));getAttrs(e,(function(t){var a={};try{a=e.reduce((function(e,a){var r,i="",s="";try{if(t[a]&&t[a].indexOf("@{")>=0)i=t[a].replace("@{","").replace("}","");else if(!/misc/i.test(a)&&(!t[a]||Mo.indexOf(t[a])<0)){if(r=a.match(/Perform|Profession|Craft|Lore|Artistry|Knowledge/i))switch(r[0]){case"Perform":i="CHA-mod";break;case"Profession":i="WIS-mod";break;case"Craft":case"Knowledge":case"Artistry":case"Lore":i="INT-mod"}i||(s=a.slice(0,-8),(i=pi[s])||(i=di[s]),i&&(i=i.toUpperCase()+"-mod"))}i&&i!==t[a]&&(e[a]=i)}catch(e){n().error("Migrate Skill dropdowns error skillerri on "+a,e)}finally{return e}}),{})}catch(e){n().error("PFSheet.migrate Skills dropdowns ",e)}finally{Va.size(a)?setAttrs(a,o.silentParams,r):(n().warn("Migrate skill dropdowns, there was nothing to set!"),r())}}))}())}))}function vu(e){getAttrs(["migrated_skill_dropdowns5","Profession-ability","Profession2-ability","Profession3-ability","Profession4-ability","Profession5-ability","Profession6-ability","Profession7-ability","Profession8-ability","Profession9-ability","Profession10-ability"],(function(t){var a={},r=0,i="";try{if(!parseInt(t.migrated_skill_dropdowns5,10))for(a.migrated_skill_dropdowns5=1,r=10;r>0&&"INT-mod"===t[i=r>1?"Profession"+r+"-ability":"Profession-ability"];r--)a[i]="WIS-mod"}catch(e){n().error("PFSheet.migrate Skills dropdowns ",e)}finally{Va.size(a)?setAttrs(a,o.silentParams,e):"function"==typeof e&&e()}}))}on("change:add_common_buff",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+", event: "+e.sourceType),_u(0,e))}))),Va.each(Zl,(function(e,t){Va.each(e,(function(e,a){on("change:"+e,n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+", event: "+e.sourceType),du(t))})))}))})),Va.each(Jl,(function(e,t){Va.each(e,(function(e){on("change:"+e,n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+", event: "+e.sourceType),du(t))})))}))})),tu.forEach((function(e){var t="change:repeating_buff2:"+e;on(t+"_macro-text",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" for column "+e+", event: "+t.sourceType),an("repeating_buff2_"+e+"_macro-text","repeating_buff2_"+e+"_val",0,null,!1)}))),on(t+"_bonustype",n().callback((function(t){"player"!==t.sourceType&&"api"!==t.sourceType||getAttrs(["repeating_buff2_"+e+"_val","repeating_buff2_"+e+"-show","repeating_buff2_"+e+"_bonus","repeating_buff2_enable_toggle"],(function(a){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType,a),parseInt(a["repeating_buff2_"+e+"-show"],10)&&parseInt(a.repeating_buff2_enable_toggle,10)&&parseInt(a["repeating_buff2_"+e+"_val"],10)&&a["repeating_buff2_"+e+"_bonus"]&&du(a["repeating_buff2_"+e+"_bonus"])}))}))),on(t+"-show ",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"player"!==t.sourceType&&"api"!==t.sourceType||getAttrs(["repeating_buff2_"+e+"_val","repeating_buff2_"+e+"_bonus","repeating_buff2_enable_toggle"],(function(a){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType,a),parseInt(a.repeating_buff2_enable_toggle,10)&&parseInt(a["repeating_buff2_"+e+"_val"],10)&&a["repeating_buff2_"+e+"_bonus"]&&du(a["repeating_buff2_"+e+"_bonus"])}))}))),on(t+"_val",n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"sheetworker"!==t.sourceType&&"api"!==t.sourceType||getAttrs(["repeating_buff2_"+e+"-show","repeating_buff2_"+e+"_bonus","repeating_buff2_enable_toggle"],(function(a){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType,a),parseInt(a.repeating_buff2_enable_toggle,10)&&parseInt(a["repeating_buff2_"+e+"-show"],10)&&a["repeating_buff2_"+e+"_bonus"]&&du(a["repeating_buff2_"+e+"_bonus"])}))}))),on(t+"_bonus",n().callback((function(t){"player"!==t.sourceType&&"api"!==t.sourceType||getAttrs(["repeating_buff2_"+e+"_val","repeating_buff2_"+e+"_bonus","repeating_buff2_"+e+"_hide","repeating_buff2_enable_toggle"],(function(a){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType,a);var r={};nu.indexOf(a["repeating_buff2_"+e+"_bonus"])>=0?(r["repeating_buff2_"+e+"_hide"]=1,Ja(r,o.silentParams)):1===parseInt(a["repeating_buff2_"+e+"_hide"],10)&&(r["repeating_buff2_"+e+"_hide"]=0,Ja(r,o.silentParams)),parseInt(a.repeating_buff2_enable_toggle,10)&&parseInt(a["repeating_buff2_"+e+"_val"],10)&&fu(null,null)}))})))})),on("change:repeating_buff2:add_note_to_roll",n().callback((function(e){"player"===e.sourceType&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),ou(null,e))}))),on("change:repeating_buff2:enable_toggle",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["repeating_buff2_b1_bonus","repeating_buff2_b2_bonus","repeating_buff2_b3_bonus","repeating_buff2_b4_bonus","repeating_buff2_b5_bonus","repeating_buff2_b6_bonus","repeating_buff2_b1-show","repeating_buff2_b2-show","repeating_buff2_b3-show","repeating_buff2_b4-show","repeating_buff2_b5-show","repeating_buff2_b6-show","repeating_buff2_enable_toggle","repeating_buff2_tabcat2"],(function(t){var a={};n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType,t),tu.forEach((function(e){t["repeating_buff2_"+e+"_bonus"]&&parseInt(t["repeating_buff2_"+e+"-show"],10)&&du(t["repeating_buff2_"+e+"_bonus"])})),ou(null,e),a.repeating_buff2_tabcat2=t.repeating_buff2_enable_toggle||"0",Ja(a,o.silentParams)}))}))),on("change:repeating_buff2:bufftype",n().callback((function(e){var t={};"player"===e.sourceType&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["buffs_tab","repeating_buff2_bufftype","repeating_buff2_tabcat"],(function(e){t.buffs_tab=e.repeating_buff2_bufftype||"99",t.repeating_buff2_tabcat=e.repeating_buff2_bufftype||"-1",Ja(t,o.silentParams)})))}))),on("remove:repeating_buff2",n().callback((function(e){n().debug("caught remove "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||fu(null,null)}))),Va.each(iu.buffTotalNonAbilityEvents,(function(e,t){var a="change:buff_"+t+"-total";Va.each(e,(function(e){on(a,n().callback((function(a){n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),"sheetworker"!==a.sourceType&&"api"!==a.sourceType||e(t,a)})))}))})),Va.each(iu.buffTotalAbilityEvents,(function(e,t){var a="change:buff_"+t+"-total change:buff_"+t+"-total_penalty";Va.each(e,(function(e){on(a,n().callback((function(a){n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),"sheetworker"!==a.sourceType&&"api"!==a.sourceType||e(t,a)})))}))})),Va.each(iu.buffTotalEventsNoParam,(function(e,t){var a="change:buff_"+t+"-total";Va.each(e,(function(e){on(a,n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),"sheetworker"!==t.sourceType&&"api"!==t.sourceType||e(null,!1,null,t)})))}))})),on("change:merge_buffs_now",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"===e.sourceType&&getAttrs(["merge_buffs_now"],(function(e){parseInt(e.merge_buffs_now),su(fu)}))}))),["customa1","customa2","customa3","customa4","customa5","customa6","customa7","customa8","customa9","customa10","customa11","customa12"].forEach((function(e){on("change:buff_"+e+"-total",n().callback((function(t){"sheetworker"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),rn(null,null,e,o.customEquationMacros[e],"buff_"+e+"-total"))})))}));var ku=n().callback((function(e,t,a){yu((function(){!function(e,t){var a=Va.size(o.abilityScoreManualDropdowns),r=Va.size(o.levelPlusBABManualDropdowns),i=Va.once((function(){"function"==typeof e&&e()})),s=Va.after(2,i),c=Va.after(a,s),l=Va.after(r,s);try{Va.each(o.abilityScoreManualDropdowns,(function(e,a){try{Bn(a,e,c,t)}catch(e){n().error("PFSheet.recalcDropdowns",e),c()}})),Va.each(o.levelPlusBABManualDropdowns,(function(e){try{Bn(e,e+"-mod",l,t)}catch(e){n().error("PFSheet.recalcDropdowns",e),l()}}))}catch(e){n().error("PFSheet.recalcDropdowns OUTER wtf how did this happen?",e)}finally{i()}}((function(){vu(),function(e,t){var a=Va.size(o.equationMacros),r=Va.once((function(){"function"==typeof e&&e()})),i=Va.after(a,r);try{Va.each(o.equationMacros,(function(e,a){try{an(a,e,0,i,t)}catch(e){n().error("PFSheet.recalcExpressions",e),i()}}))}catch(e){n().error("PFSheet.recalcExpressions OUTER wtf how did this happen?",e)}finally{r()}}((function(){!function(e,t){var a,r=Va.size(o.customEquationMacros),i=Va.once((function(){"function"==typeof e&&e()})),s=Va.after(r,i);try{a=Va.reduce(o.customEquationMacros,(function(e,t,a){return e.concat([a,t,"buff_"+Gl[a]+"-total"])}),[]),getAttrs(a,(function(e){Va.each(o.customEquationMacros,(function(a,n){nn(s,t,e[n],a,e[a],e["buff_"+Gl[n]+"-total"])}))}))}catch(e){n().error("PFCustom.recalculate OUTER wtf how did this happen?",e)}finally{i()}}((function(){hu(e)}),t)}),t)}),t)}))}));function wu(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["npc-hd","PFSheet_Version","npc-hd-num","level","hp","hp_max","is_newsheet","npc-type"],(function(e){parseInt(e.is_newsheet,10)||0===(parseInt(e.PFSheet_Version,10)||0)||!(e["npc-type"]||parseInt(e["npc-hd"],10)||parseInt(e["npc-hd-num"],10)||parseInt(e.level,10)||parseInt(e.hp,10)||parseInt(e.hp_max,10))?Ja({auto_calc_hp:1,autohp_percent:1,maxhp_lvl1:0,normal_macro_show:1,"max-dex-source":3,both_whisper_show:1,use_traits:0,use_racial_traits:0,tab:8,is_v1:1,"npc-compimport-show":1},o.silentParams,a):a()}))}on("change:customd1 change:customd2 change:customd3 change:customd4 change:customd5 change:customd6 change:customd1-name change:customd2-name change:customd3-name change:customd4-name change:customd5-name change:customd6-name",n().callback((function(e){"player"===e.sourceType&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),hu(e))}))),on("change:use_advanced_options",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["use_advanced_options"],(function(e){parseInt(e.use_advanced_options,10)?Ja({extra_fields_attacks_show:1,skill_onetimecolumns_show:1,extra_fields_saves_show:1,extra_fields_spells_show:1,extra_fields_defense_show:1,extra_fields_caster_show:1,extra_fields_abilities_show:1,extra_fields_init_show:1,extra_fields_speeds_show:1,extra_fields_conditions_show:1},o.silentParams):Ja({extra_fields_attacks_show:0,skill_onetimecolumns_show:0,extra_fields_saves_show:0,extra_fields_spells_show:0,extra_fields_defense_show:0,extra_fields_caster_show:0,extra_fields_abilities_show:0,extra_fields_init_show:0,extra_fields_speeds_show:0,extra_fields_conditions_show:0},o.silentParams)})))}))),Va.each(o.abilityScoreManualDropdowns,(function(e,t){on("change:"+t,n().callback((function(a){"player"!==a.sourceType&&"api"!==a.sourceType||(n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),Bn(t,e))})))})),Va.each(o.equationMacros,(function(e,t){on("change:"+t,n().callback((function(a){n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),an(t,e)})))})),Va.each(o.customEquationMacros,(function(e,t){on("change:"+t,n().callback((function(a){n().debug("caught "+a.sourceAttribute+" event: "+a.sourceType),rn(null,null,t,e,"buff_"+t+"-total")})))})),on("change:kineticist_level",n().callback((function(e){"player"===e.sourceType&&(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Bn("kineticist_level","kineticist_level-mod"))})));var Au=n().callback((function(e,t,a){!function(e){Qn(e)}(Va.once((function(){n().info("leaving PFNPC.recalculate"),"function"==typeof e&&e()})))}));function Cu(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));!function(e,t,a){!e||a&&"function"!=typeof a||getAttrs([e],(function(n){var r=cn(n[e],t);r?getAttrs([r],(function(e){var t=parseInt(e[r],10);isNaN(t)?a(e[r]):a(t)})):a(r),a(r)}))}("selected-ability-psionic-power",null,(function(e){getAttrs(["psionic-level-total","ability-psionic-power"],(function(r){var i=0,s=0,c=0,l={};try{i=parseInt(e,10)||0,s=parseInt(r["ability-psionic-power"],10)||0,c=Math.floor(i*(parseInt(r["psionic-level-total"],10)||0)*.5),n().debug("PFSIONIC ability="+i,"newTotal="+c,"currentTotal="+s),s!==c&&(t&&(l=o.silentParams),Ja({"ability-psionic-power":c},l,a))}catch(e){n().error("PFPsionic.updatePsionicBonusPower",e)}finally{a()}}))}))}on("change:is_npc",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["is_npc"],(function(t){1===parseInt(t.is_npc,10)&&wu(e)}))})));var Iu=n().callback((function(e,t,a){var r=Va.once((function(){n().info("Leaving PFPsionic.recalculate"),"function"==typeof e&&e()}));getAttrs(["psionics-show"],(function(e){try{1===parseInt(e["psionics-show"],10)?Cu(r,t):r()}catch(e){n().error("PFPsionic.recalculate",e),r()}}))}));function xu(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["mythic-tier","mythic-hp","total-mythic-hp"],(function(e){var r=0,i={},s={};try{r=(parseInt(e["mythic-tier"],10)||0)*(parseInt(e["mythic-hp"],10)||0),(parseInt(e["total-mythic-hp"],10)||0)!==r&&(i["total-mythic-hp"]=r)}catch(e){n().error("PFMythic.updateTierMythicPower error",e)}finally{Va.size(i)>0?(t&&(s=o.silentParams),Ja(i,s,a)):a()}}))}function Pu(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["tier-mythic-power","mythic-tier"],(function(e){var r,i={},s={};try{r=3+2*(parseInt(e["mythic-tier"],10)||0),(parseInt(e["tier-mythic-power"],10)||0)!==r&&(i["tier-mythic-power"]=r)}catch(e){n().error("PFMythic.updateTierMythicPower error",e)}finally{Va.size(i)>0?(t&&(s=o.silentParams),Ja(i,s,a)):a()}}))}on("change:psionic-level change:psionic-level-misc",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||pn(["psionic-level-total","psionic-level","psionic-level-misc"])}))),on("change:class-psionic-power change:ability-psionic-power change:misc-psionic-power",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),("player"===e.sourceType||"api"===e.sourceType||"sheetworker"===e.sourceType||"api"===e.sourceType&&"ability-psionic-power"===e.sourceAttribute)&&pn(["psionic-power_max","class-psionic-power","ability-psionic-power","misc-psionic-power"])}))),on("change:selected-ability-psionic-power change:psionic-level-total",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Cu()})));var Su=n().callback((function(e,t,a){var r=Va.once((function(){n().info("leaving PFMythic.recalculate"),"function"==typeof e&&e()}));getAttrs(["mythic-adventures-show"],(function(e){try{1===parseInt(e["mythic-adventures-show"],10)?(xu(r,t),Pu()):r()}catch(e){n().error("PFMythic.recalculate",e),r()}}))}));function Tu(e,t,a){jo((function(){Cr(),Wi()}),null),sl()}function Eu(e){jo(null,null),Cr(null,null),qc()}function Du(e,t,a){var n=Va.once((function(){"function"==typeof e&&e()}));getAttrs(["condition-Drained","condition_is_drained"],(function(e){var t=parseInt(e["condition-Drained"],10)||0,a=parseInt(e.condition_is_drained,10)||0;0!==t&&0===a?Ja({condition_is_drained:1,"condition-Drained-toggle":1},o.silentParams,n):0===t&&0!==a?Ja({condition_is_drained:0,"condition-Drained-toggle":0},o.silentParams,n):n()}))}function Mu(e,t){getAttrs(["migrated_fatigue_conditions","condition-Fatigued"],(function(t){var a={};parseInt(t.migrate_fatigued_conditions,10)?"function"==typeof e&&e():(3===parseInt(t["condition-Fatigued"],10)&&(a["condition-Fatigued"]=0,a["condition-Exhausted"]=3),a.migrate_fatigued_conditions=1,Ja(a,o.silentParams,e))}))}on("change:mythic-tier change:mythic-hp",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||(xu(),Pu())}))),on("change:mythic-hp",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||xu()}))),on("change:misc-mythic-power change:tier-mythic-power",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),("player"===e.sourceType||"api"===e.sourceType||"sheetworker"===e.sourceType||"api"===e.sourceType&&"tier-mythic-power"===e.sourceAttribute)&&pn(["mythic-power_max","tier-mythic-power","misc-mythic-power"])})));var Fu=n().callback((function(e,t,a){Mu((function(){Du(e)}))})),Nu={conditionEventsEither:{"change:condition-wounds change:has_endurance_feat change:wounds_gritty_mode":[Dl,$o,Cr,Wi]},conditionEventsPlayer:{"change:condition-grappled":[function(e,t,a){getAttrs(["condition-Pinned","condition-Grappled"],(function(e){parseInt(e["condition-Pinned"],10)&&parseInt(e["condition-Grappled"],10)?Ja({"condition-Pinned":"0"},o.silentParams,(function(){Tu()})):Tu()}))}],"change:condition-pinned":[function(e,t,a){getAttrs(["condition-Pinned","condition-Grappled"],(function(e){parseInt(e["condition-Pinned"],10)&&parseInt(e["condition-Grappled"],10)?Ja({"condition-Grappled":"0"},o.silentParams,(function(){Tu()})):Tu()}))}],"change:condition-Fatigued":[function(e,t,a){getAttrs(["condition-Fatigued","condition-Exhausted"],(function(e){(e=Va.mapObject(e,(function(e,t){return parseInt(e,10)||0})))["condition-Fatigued"]&&e["condition-Exhausted"]?Ja({"condition-Exhausted":"0"},o.silentParams,(function(){Eu()})):Eu()}))}],"change:condition-Exhausted":[function(e,t,a){getAttrs(["condition-Fatigued","condition-Exhausted"],(function(e){(e=Va.mapObject(e,(function(e,t){return parseInt(e,10)||0})))["condition-Fatigued"]&&e["condition-Exhausted"]?Ja({"condition-Fatigued":"0"},o.silentParams,(function(){Eu()})):Eu()}))}],"change:condition-sickened":[mo,Dl,$o,Cr],"change:condition-stunned":[Bi,Wi],"change:condition-flat-footed":[Bi],"change:condition-deafened":[Ml,sl,Dl],"change:condition-fascinated":[Dl],"change:condition-entangled":[jo,Cr,qc],"change:condition-drained":[Du,xl,Dl,$o,Cr,Wi],"change:condition-fear":[Dl,$o,Cr],"change:condition-blinded":[Dl,Wi],"change:condition-cowering":[Wi],"change:condition-invisible":[Bi,Cr,Dl,Wi],"change:condition-dazzled":[Cr,Dl],"change:condition-prone":[Wi,function(e,t,a){Pr(null,t,["melee","melee2","CMB","CMB2"])}],"change:condition-paralyzed":[function(e,t,a){Bo("DEX"),Bo("STR"),Wi(null,null,a)}],"change:condition-helpless":[function(e,t,a){Bo("DEX"),Wi(null,null,a)}]}};function Ru(e){var t=function(){"function"==typeof e&&e()};getAttrs(["use_horror_adventures","sanity_threshold","sanity-ability-mod","sanity_threshold_misc-mod"],(function(e){var a=0,r=0,i={};try{parseInt(e.use_horror_adventures,10)&&(a=parseInt(e.sanity_threshold,10)||0,r=(parseInt(e["sanity-ability-mod"],10)||0)+(parseInt(e["sanity_threshold_misc-mod"],10)||0),a!==(r=Math.max(1,r))&&(i.sanity_threshold=r))}catch(e){n().error("PFHorror.setSanityThreshold error",e)}finally{Va.size(i)?Ja(i,o.silentParams,t):t()}}))}function zu(e){var t=function(){"function"==typeof e&&e()};getAttrs(["use_horror_adventures","sanity_score_max","sanity_edge","sanity_score_misc-mod","WIS","INT","CHA","WIS-damage","INT-damage","CHA-damage","WIS-penalty","INT-penalty","CHA-penalty","buff_WIS-total_penalty","buff_INT-total_penalty","buff_CHA-total_penalty"],(function(e){var a=0,r=0,i={};try{parseInt(e.use_horror_adventures,10)&&(parseInt(e.sanity_score_max,10)||0)!==(a=(parseInt(e["sanity_score_misc-mod"],10)||0)+(parseInt(e.WIS,10)||0)+(parseInt(e.INT,10)||0)+(parseInt(e.CHA,10)||0)+(parseInt(e["WIS-damage"],10)||0)+(parseInt(e["INT-damage"],10)||0)+(parseInt(e["CHA-damage"],10)||0)+(parseInt(e["WIS-penalty"],10)||0)+(parseInt(e["INT-penalty"],10)||0)+(parseInt(e["CHA-penalty"],10)||0)+(parseInt(e["buff_WIS-total_penalty"],10)||0)+(parseInt(e["buff_INT-total_penalty"],10)||0)+(parseInt(e["buff_CHA-total_penalty"],10)||0))&&(r=Math.floor(a/2),i.sanity_score_max=a,i.sanity_edge=r)}catch(e){n().error("PFHorror.setSanityScore error",e)}finally{Va.size(i)?Ja(i,o.silentParams,t):t()}}))}Va.each(Nu.conditionEventsPlayer,(function(e,t){Va.each(e,(function(e){on(t,n().callback((function(t){"player"!==t.sourceType&&"api"!==t.sourceType||(n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),e(null,null,t))})))}))})),Va.each(Nu.conditionEventsEither,(function(e,t){Va.each(e,(function(e){on(t,n().callback((function(t){n().debug("caught "+t.sourceAttribute+" event: "+t.sourceType),e(null,null,t)})))}))})),on("change:Perception-cond",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),hi("Perception",(function(t){vi(t?"Perception":"CS-Perception",e)}))})));var Lu=n().callback((function(e){zu(),Ru(),"function"==typeof e&&(n().info("Leaving PFHorror.recalculate"),e())}));function Ou(e,t,a){getAttrs(["kineticist_level-mod","kineticist_ability-mod","kineticblast_dc"],(function(t){var a,n={};(parseInt(t.kineticblast_dc,10)||0)!==(a=10+(parseInt(t["kineticist_ability-mod"],10)||0)+Math.floor((parseInt(t["kineticist_level-mod"],10)||0)/2))?(n.kineticblast_dc=a,Ja(n,o.silentParams,e)):"function"==typeof e&&e()}))}on("change:sanity_score_misc-mod change:WIS change:INT change:CHA change:buff_WIS-total_penalty change:buff_INT-total_penalty change:buff_CHA-total_penalty",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||zu()}))),on("change:WIS-damage change:INT-damage change:CHA-damage change:WIS-penalty change:INT-penalty change:CHA-penalty",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||zu()}))),on("change:sanity-ability-mod change:sanity_threshold_misc-mod",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"sheetworker"!==e.sourceType&&"api"!==e.sourceType||Ru()}))),on("change:use_horror_adventures",n().callback((function(e){getAttrs(["use_horror_adventures"],(function(e){parseInt(e.use_horror_adventures,10)&&(zu(),Ru())}))})));var qu=n().callback((function(e,t,a){getAttrs(["use_burn"],(function(t){parseInt(t.use_burn,10)&&Ou(),"function"==typeof e&&(n().info("leaving PFOccult.recalculate"),e())}))}));function Hu(e){var t=Va.once((function(){var t={is_newsheet:0,is_v1:1,use_buff_bonuses:1,use_advanced_options:0,modify_dmg_by_size:1,PFSheet_Version:String(o.version.toFixed(2))};t[o.announcementVersionAttr]=1,Ja(t,o.silentParams,(function(){"function"==typeof e&&e()}))}));getAttrs(["is_npc","set_pfs"],(function(e){var a=parseInt(e.is_npc,10)||0,n=parseInt(e.set_pfs,10)||0;!function(e){var t=Va.once((function(){"function"==typeof e&&e()}));Ja(rr(),o.silentParams,t)}((function(){Di(),yu(),a?wu(t):n?Sl(t):t()}))}))}function Bu(e,t,a){var r,i=Va.once((function(){n().debug("leaving PFSheet.migrate"),"function"==typeof t&&t()})),s=Va.once((function(){n().warn("leaving PFSheet.migrate ERROR UPGRADE NOT FINISHED"),"function"==typeof a?a():i()}));try{e<1?(r=Va.after(7,(function(){n().info("PFSheet.migrate we finished calling all the migrates"),i()})),nr(n().callback((function(){hs(r),Di(r),Tl(r,e),To(r),Pc(r),ic(r),Ws(r)})),e)):e<1.17?(e<1.02&&(Pc(null),ic(null)),e<1.05&&gr(),e<1.07&&hs(null),e<1.1&&(er(),ic(null)),e<1.12&&Pc(null),e<1.17&&hs((function(){rs()}))):(e<1.18&&(Fl(null,!1,e),El(null,!1,e),tr(null,e)),e<1.2&&El(),e<1.4&&(ar(),rs(),Tr(),yc(),ac(),Eo(),hl()),e<1.43&&(Gs(),Ei()),e<1.5&&(Ls(0,0,null),ss(),So(null,e)),e<1.53&&(Di(null),Jc((function(){Hc()}))),e<1.54&&bu(),e<1.55&&(Eo(),Di()),e<1.56&&mo(),e<1.57&&Bi(),e<=1.65&&yu((function(){gu((function(){Mu((function(){bu((function(){ku((function(){Di((function(){Ai()})),bc(),ds(),Mr((function(){bo(),yo(),Io()})),hs()}))}))}))}))})),e<1.68&&yu((function(){Mi(null,null,e),Xi(null,null,e),Mr(null,null,e)})),e<1.69&&(ul(null,null,e),sc(null,null,e),Eo(null,null,e),Ec(null,null,e),ys(null,null,e),bu(null,null,e),Xi(null,null,e)),e<1.693&&vu(Mi),e<1.697&&Eo(null,null,e),e<1.72&&(Jc(e,(function(){bo(null)})),Ls()),e<1.724&&Di(null),e<1.731&&getSectionIDs("repeating_ability",(function(e){getSectionIDs("repeating_weapon",(function(t){getSectionIDs("repeating_spells",(function(a){getSectionIDs("repeating_spells",(function(r){var i={},s=[],c=[],o=[],l=[];Va.each(e,(function(e){s.push("repeating_ability_".concat(e,"_macro-text"))})),Va.each(t,(function(e){c.push("repeating_weapon_".concat(e,"_macro-text"))})),Va.each(a,(function(e){o.push("repeating_spells_".concat(e,"_macro-text"))})),Va.each(r,(function(e){l.push("repeating_spells_".concat(e,"_npc-macro-text"))})),getAttrs([].concat(Xn(e),Xn(t),Xn(a),Xn(r)),(function(s){Va.each(e,(function(e){var t=s["repeating_ability_"+e+"_macro-text"]||"";/{{scroll_desc=@{scroll-desc}}}/.test(t)||(t=t.replace(/(&{template:[^}]+})/g,"$1 {{scroll_desc=@{scroll-desc}}}"),i["repeating_ability_"+e+"_macro-text"]=t,n().debug("macro-text updated for repeating_ability_"+e+"_macro-text:"+t))})),Va.each(t,(function(e){var t=s["repeating_weapon_"+e+"_macro-text"]||"";/{{scroll_desc=@{scroll-desc}}}/.test(t)||(t=t.replace(/(&{template:[^}]+})/g,"$1 {{scroll_desc=@{scroll-desc}}}"),i["repeating_weapon_"+e+"_macro-text"]=t,n().debug("macro-text updated for repeating_weapon_"+e+"_macro-text:"+t))})),Va.each(a,(function(e){var t=s["repeating_spells_"+e+"_macro-text"]||"";/{{scroll_desc=@{scroll-desc}}}/.test(t)||(t=t.replace(/(&{template:[^}]+})/g,"$1 {{scroll_desc=@{scroll-desc}}}"),i["repeating_spells_"+e+"_macro-text"]=t,n().debug("macro-text updated for repeating_spells_"+e+"_macro-text:"+t))})),Va.each(r,(function(e){var t=s["repeating_spells_"+e+"_npc-macro-text"]||"";/{{scroll_desc=@{scroll-desc}}}/.test(t)||(t=t.replace(/(&{template:[^}]+})/g,"$1 {{scroll_desc=@{scroll-desc}}}"),i["repeating_spells_"+e+"_npc-macro-text"]=t,n().debug("macro-text updated for repeating_spells_"+e+"_npc-macro-text:"+t))}))})),setAttrs(i,{silent:!0})}))}))}))})),e<1.732&&getAttrs(["Melee-Attack-macro","Melee2-Attack-macro","Ranged-Attack-macro","Ranged2-Attack-macro","CMB-Check-macro","CMB2-Check-macro"],(function(e){var t=e["Melee-Attack-macro"],a=e["Melee2-Attack-macro"],r=e["Ranged-Attack-macro"],i=e["Ranged2-Attack-macro"],s=e["CMB-Check-macro"],c=e["CMB2-Check-macro"];/@{global/.test(t)&&(t=t.replace(/@{global/g,"@{toggle_global"),n().debug("~~~~~~~~~current macroTextMelee macro-text: "+t),setAttrs($n({},"Melee-Attack-macro",t)),n().debug("~~~~~~~~~@{Melee-Attack-macro} macro-text updated: "+t)),/@{global/.test(a)&&(a=a.replace(/@{global/g,"@{toggle_global"),n().debug("~~~~~~~~~current macroTextMelee2 macro-text: "+a),setAttrs($n({},"Melee2-Attack-macro",a)),n().debug("~~~~~~~~~@{Melee2-Attack-macro} macro-text updated: "+a)),/@{global/.test(r)&&(r=r.replace(/@{global/g,"@{toggle_global"),n().debug("~~~~~~~~~current macroTextRanged macro-text: "+r),setAttrs($n({},"Ranged-Attack-macro",r)),n().debug("~~~~~~~~~@{Ranged-Attack-macro} macro-text updated: "+r)),/@{global/.test(i)&&(i=i.replace(/@{global/g,"@{toggle_global"),n().debug("~~~~~~~~~current macroTextRanged2 macro-text: "+i),setAttrs($n({},"Ranged2-Attack-macro",i)),n().debug("~~~~~~~~~@{Ranged2-Attack-macro} macro-text updated: "+i)),/@{global/.test(s)&&(s=s.replace(/@{global/g,"@{toggle_global"),n().debug("~~~~~~~~~current macroTextCMB macro-text: "+s),setAttrs($n({},"CMB-Check-macro",s)),n().debug("~~~~~~~~~@{CMB-Check-macro} macro-text updated: "+s)),/@{global/.test(c)&&(c=c.replace(/@{global/g,"@{toggle_global"),n().debug("~~~~~~~~~current macroTextCMB2 macro-text: "+c),setAttrs($n({},"CMB2-Check-macro",c)),n().debug("~~~~~~~~~@{CMB2-Check-macro} macro-text updated: "+c))})),e<1.787&&setAttrs({include_link_abilities:1,include_link_spells:1}),e<1.822&&Xs(),e<1.826&&getSectionIDs("repeating_ability",(function(e){var t=[];Va.each(e,(function(e){t.push("repeating_ability_"+e+"_macro-text","repeating_ability_"+e+"_ability_type2","repeating_ability_"+e+"_rule_category")})),getAttrs([].concat(t),(function(t){var a={};Va.each(e,(function(e){var r=t["repeating_ability_"+e+"_macro-text"],i=t["repeating_ability_"+e+"_ability_type2"],s=t["repeating_ability_"+e+"_rule_category"],c=/feats/g.test(s)||/traits/g.test(s)?1:0,o="";n().debug("~~~ id:".concat(e," featOrTraitCheck:").concat(c," ability_type2:").concat(i," ~~~")),0===c?/{{subtitle=.*{@{rule_category}} - @{ability_type2}}}/g.test(r)&&(o=r.replace(/{{subtitle=.*{@{rule_category}} - @{ability_type2}}}/g,"{{subtitle=^{@{rule_category}}}}"),a["repeating_ability_"+e+"_macro-text"]=o,n().debug("macro-text updated for repeating_ability_"+e+"_macro-text: "+o)):1===c&&""!==i&&/{{subtitle=.*@{rule_category}}}}/g.test(r)&&(o=r.replace(/{{subtitle=.*@{rule_category}}}}/g,"{{subtitle=^{@{rule_category}} - @{ability_type2}}}"),a["repeating_ability_"+e+"_macro-text"]=o,n().debug("macro-text updated for repeating_ability_"+e+"_macro-text: "+o))})),setAttrs(a,{silent:!0})}))})),e<1.829&&Eo(null,null,e))}catch(e){n().error("PFSheet.migrate",e),s()}finally{i()}}function Uu(e,t,a){var r=function(){n().info("leaving PFSheet.recalculate"),"function"==typeof t&&t()},i=n().callback((function(){!function(e,t,a){var r=Va.once((function(){n().info("leaving PFSheet.recalculateParallelModules"),"function"==typeof e&&e()})),i=[ul,Zo,sc,Iu,Mi,Ec,Fl,Eo,Lu,qu],s=Va.size(i),c=Va.after(s,r),o=0,l=function(){o++,n().info("PFSheet.recalculateParallelModules, finished "+o+" modules"),c()};try{Va.each(i,(function(e){try{e(l,t,a)}catch(e){n().error("PFSheet.recalculateParallelModules error calling recalculate",e),l()}}))}catch(e){n().error("PFSheet.recalculateParallelModules OUTER error!",e),r()}}(r,a,e)})),s=n().callback((function(){!function(e,t,a){var r=Va.once((function(){"function"==typeof e&&e()})),i=function(){Bc(r,t,a)},s=Va.after(2,i);try{ys(s,t,a),Xi(s,t,a)}catch(e){n().error("pfsheet.recalculateDefenseAndEncumbrance",e),i()}}(i,a,e)})),c=n().callback((function(){!function(e,t,a){var n=Va.once((function(){"function"==typeof e&&e()})),r=Va.once((function(){Jc(n,t,a)})),i=Va.once((function(){El(r,t,a)})),s=Va.once((function(){Au(i,t,a)})),c=Va.once((function(){Su(s,t,a)})),o=Va.once((function(){ku(c,t,a)})),l=Va.once((function(){Dl(o)})),u=Va.once((function(){vl(l,t,a)})),p=Va.once((function(){Go(u,t,a)})),d=Va.once((function(){Fu(p,t,a)}));nr(Va.once((function(){bu(d,t,a)})),a)}(s,a,e)}));a=!0,c()}function ju(e){var t=function(){n().info("leaving PFSheet.checkForUpdate"),Ja({recalc1:0,migrate1:0,is_newsheet:0},o.silentParams)},a=Va.once((function(){n().warn("leaving PFSheet.checkForUpdate ERROR UPGRADE NOT FINISHED DO NOT RESET VERSION"),Ja({recalc1:0,migrate1:0},{silent:!0})}));getAttrs(["PFSheet_Version","migrate1","recalc1","is_newsheet","is_v1","hp","hp_max","npc-hd","npc-hd-num","race","class-0-name","npc-type","level","hide_announcements",o.announcementVersionAttr],(function(r){var i={},s=!1,c=!1,l=!1,u=parseFloat(r.PFSheet_Version,10)||0;n().notice("Attributes at version: "+u),e?l=!0:(parseInt(r.recalc1,10)&&(l=!0),parseInt(r.migrate1,10)&&(s=!0),(parseInt(r.is_newsheet,10)||0===u&&(parseInt(r.is_v1,10)||!(parseInt(r.hp,10)||parseInt(r.hp_max,10)||parseInt(r["npc-hd"],10)||parseInt(r["npc-hd-num"],10)||r.race||r["class-0-name"]||r["npc-type"]||parseInt(r.level,10))))&&(c=!0)),u!==o.version&&(s=!0),c||!parseInt(r.hide_announcements,10)||parseInt(r[o.announcementVersionAttr],10)||(i[o.announcementVersionAttr]=1,Ja(i,o.silentParams)),c?Hu(t):s?(n().notice("UPGRADE SHEET"),Bu(u,(function(){Ja({recalc1:0,migrate1:0,is_newsheet:0,character_sheet:"Pathfinder_Neceros v"+String(o.version),PFSheet_Version:String(o.version.toFixed(3))},o.silentParams,(function(){u<1.17&&Uu(u,null,!1)}))}),a)):l?Uu(u=-1,t,!0):t()}))}function Wu(e){return Va.isUndefined(e)||""===e?0:parseInt(e)||0}function Gu(e,t){return Math.max(0,Math.floor((e+4-t)/4))}function Xu(e,t){return Va.map(e,(function(e){return e[t]})).join(", ")}function Vu(e){return Va.isUndefined(e)?[]:Array.isArray(e)?e:new Array(e)}function $u(e,t){var a=Object.values(e),n=Object.keys(e),r=Va.find(a,(function(e){var r=e;if((r=r.replace(/ x[0-9]+$/,"").trim())===t){var i=n[Va.indexOf(a,e)];if(!Va.isUndefined(i))return!0}return!1}));return Va.isUndefined(r)?generateRowID():n[Va.indexOf(a,r)]}function Ku(e,t,a,n,r){var i="repeating_item";getSectionIDs(i,(function(s){var c=Va.union(Va.map(s,(function(e){return"".concat(i,"_").concat(e,"_name")})),["shield3-acp","shield3-spell-fail"]);getAttrs(c,(function(s){var c=Wu(s["shield3-acp"]),o=Wu(s["shield3-spell-fail"]);Va.isUndefined(s["shield3-acp"])||delete s["shield3-acp"],Va.isUndefined(s["shield3-spell-fail"])||delete s["shield3-spell-fail"];var l=Va.object(Va.map(s,(function(e,t){return[t.substring(i.length+1,t.indexOf("_name")),e]}))),u=[],p={},d=Va.map(n,(function(e){return e._name})),f=Va.map(r,(function(e){return e._name})),m=["mithral","adamantine","angelskin","darkleaf","darkwood","dragonhide","eel","fire-forged","frost-forged","greenwood","paueliel"];Va.each(e,(function(e){var s,_,g,b,h,y,v=(s=l,_=e._name,g=Object.values(s),b=Object.keys(s),h=_.replace(/\(.*\)/,"").replace(/\+\d+/,"").toLowerCase().replace("masterwork","").trim(),y=Va.find(g,(function(e){if(e.replace(/\(.*\)/,"").replace(/\+\d+/,"").toLowerCase().replace("masterwork","").trim()===h){var t=b[Va.indexOf(g,e)];if(!Va.isUndefined(t))return!0}return!1})),Va.isUndefined(y)?generateRowID():b[Va.indexOf(g,y)]);Va.isUndefined(l[v])||delete l[v],u.push(e._name),i="repeating_item_".concat(v),p["".concat(i,"_name")]=e._name,p["".concat(i,"_item-weight")]=e.weight._value,p["".concat(i,"_value")]=parseFloat(e.cost._value)/parseInt(e._quantity),p["".concat(i,"_description")]=e.description,Va.contains(Object.keys(t),e._name)&&"1"===e._quantity&&"1"!==t[e._name]._max?(p["".concat(i,"_qty")]=t[e._name]._left,p["".concat(i,"_qty_max")]=t[e._name]._max):p["".concat(i,"_qty")]=e._quantity,Va.isUndefined(e.itempower)||Va.each(Vu(e.itempower),(function(e){u.push(e._name)}));var k,w=e._name;-1!==e._name.toLowerCase().indexOf("shield")&&(k=e._name.toLowerCase().indexOf(!0)?"heavy shield bash":"light shield bash",w=Va.find(f,(function(e){return-1!==e.toLowerCase().indexOf(k)}))||e._name);if(Va.contains(f,w)){var A=r[Va.indexOf(f,w)];if("As Spell"!==A._damage){if(p["".concat(i,"_item-wpenhance")]=Wu(A._name.match(/\+\d+/)),Va.isUndefined(A._typetext)||(p["".concat(i,"_item-dmg-type")]=A._typetext),(-1!==w.toLowerCase().indexOf("masterwork")||Va.intersection(m,e._name.toLowerCase().split(" ")).length>0)&&(p["".concat(i,"_item-masterwork")]=1),!Va.isUndefined(A._damage)){var C=A._damage.match(/\d+d\d+/);!Va.isNull(C)&&C.length>0&&(p["".concat(i,"_item-damage-dice-num")]=Wu(C[0].split("d")[0]),p["".concat(i,"_item-damage-die")]=Wu(C[0].split("d")[1]))}if(!Va.isUndefined(A._crit)){var I=A._crit.split("/");I.length>1?p["".concat(i,"_item-crit-target")]=Wu(I[0].match(/\d+/)[0]):p["".concat(i,"_item-crit-target")]=20,p["".concat(i,"_item-crit-multiplier")]=Wu(I[I.length-1].replace(/\D/g,""))}Va.isUndefined(A.rangedattack)||Va.isUndefined(A.rangedattack._rangeincvalue)||(p["".concat(i,"_item-range")]=Wu(A.rangedattack._rangeincvalue))}}var x=e._name;if(-1!==e._name.toLowerCase().indexOf("klar")&&(x=Va.find(d,(function(e){return-1!==e.toLowerCase().indexOf("klar")}))||e._name),Va.contains(d,x)){var P=n[Va.indexOf(d,x)];if(function(e){return-1!==e.toLowerCase().indexOf("shield")||-1!==e.toLowerCase().indexOf("buckler")||-1!==e.toLowerCase().indexOf("klar")}(e._name)){var S=Wu(x.match(/\+\d+/)),T=Wu(P._ac)-S;p["".concat(i,"_item-acbonus")]=T,p["".concat(i,"_item-acenhance")]=S,Va.isUndefined(P._equipped)||"yes"!==P._equipped||(p["".concat(i,"_item-acp")]=c,p["".concat(i,"_item-spell-fail")]=o,p.shield3=e._name,p["shield3-acbonus"]=T,p["shield3-enhance"]=S)}else{S=Wu(e._name.match(/\+\d+/)),T=Wu(P._ac)-S;p["".concat(i,"_item-acbonus")]=T,p["".concat(i,"_item-acenhance")]=S,Va.isUndefined(P._equipped)||"yes"!==P._equipped||(p["armor3-acp"]=p["".concat(i,"_item-acp")]=a.ACP-c,p["armor3-spell-fail"]=p["".concat(i,"_item-spell-fail")]=a.spellfail-o,99===a.maxDex?p["armor3-max-dex"]=p["".concat(i,"_item-max-dex")]="":p["armor3-max-dex"]=p["".concat(i,"_item-max-dex")]=a.maxDex,p.armor3=e._name,p["armor3-acbonus"]=T,p["armor3-enhance"]=S)}}})),setAttrs(p,{silent:!0})}))}))}function Yu(e,t,a,n,r){var i=Va.map(a,(function(e){return e._name})),s=[];Va.each(a,(function(a){var c,o,l,u=a._name,p=u.replace(/ x[0-9]+$/,"").replace(/\(([^\)]*)\)/g,"").trim();if(!Va.contains(s,p)){var d=Va.filter(i,(function(e){return e.replace(/\(([^\)]*)\)/g,"").trim()===p}));if(d.length>1){s.push(p);var f=Va.map(d,(function(e){return e.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","")}));u=u.replace(/\(([^\)]*)\)/,"(".concat(Va.uniq(f).join(", "),")"))}o=function(e,t){var a=Object.values(e),n=(Object.keys(e),Va.find(a,(function(e){var a=e.name;return t=t.replace(/\(.+\)/g,"").replace(/\d+d\d+(\+\d*)*/g,"").replace(/\+\d+/g,"").trim(),(a=a.replace(/\(.+\)/g,"").replace(/\d+d\d+(\+\d*)*/g,"").replace(/\+\d+/g,"").trim())===t})));return Va.isUndefined(n)?generateRowID():n.rowID}(t,u),c="repeating_ability_".concat(o),Va.isUndefined(t[o])?a.specsource?e["".concat(c,"_tabcat")]=e["".concat(c,"_rule_category")]="class-features":e["".concat(c,"_tabcat")]=e["".concat(c,"_rule_category")]="racial-traits":delete t[o],l=function(e,t){if(!e.length)return-1;var a=Object.keys(t),n=Va.intersection(e,a);if(n.length)return a.indexOf(n[0]);var r=Va.find(a,(function(a){return Va.intersection(t[a],e).length}));return r?a.indexOf(r):-1}(Vu(a.specsource),n),e["".concat(c,"_name")]=u,e["".concat(c,"_description")]=a.description,-1!==l&&(e["".concat(c,"_CL-basis")]="@{class-".concat(l,"-level}"),e["".concat(c,"_class-name")]=Object.keys(n)[l]),Va.contains(Object.keys(r),a._name)&&(e["".concat(c,"_max-calculation")]=r[a._name]._max),Va.isUndefined(a._type)||(e["".concat(c,"_tabcat2")]=e["".concat(c,"_ability_type")]=a._type.substr(0,2))}}))}function Zu(e,t){var a=["Abjurer","Conjurer","Diviner","Enchanter","Evoker","Illusionist","Necromancer","Transmuter"],n="repeating_spells";getSectionIDs(n,(function(r){var i=Va.union(Va.map(r,(function(e){return"".concat(n,"_").concat(e,"_name")})),Va.map(r,(function(e){return"".concat(n,"_").concat(e,"_spellclass_number")})));getAttrs(i,(function(r){var i={},s=Object.keys(r);Va.each(s,(function(e){var t;-1!==e.indexOf("_name")&&(t=e.substring(n.length+1,e.indexOf("_name")),Va.isUndefined(i[t])&&(i[t]={rowID:t}),i[t].name=r[e]),-1!==e.indexOf("_spellclass_number")&&(t=e.substring(n.length+1,e.indexOf("_spellclass_number")),Va.isUndefined(i[t])&&(i[t]={rowID:t}),i[t].spellclass=r[e])}));var c=Object.keys(t),o={};Va.each(e,(function(e){var r,s,l,u,p,d,f,m,_,g;switch(d=Wu(e._level),n="repeating_spells_",u=e._name.replace(/\(x\d+\)/,"").trim(),""===e._class?(s=0,l=c[0]):(l=e._class,-1===(s=Va.indexOf(c,l))&&(l=Va.intersection(c,a)[0],s=Va.indexOf(c,l))),f=i,m=u,_=s,g=Va.find(f,(function(e){return e.name===m&&e.spellclass===_})),r=Va.isUndefined(g)?generateRowID():g.rowID,Va.isUndefined(r)&&(console.log("Undefined spell row ID!"),console.log(e)),o["".concat(n+=r,"_name")]=u,o["".concat(n,"_spell_level_r")]=o["".concat(n,"_spell_level")]=d,o["".concat(n,"_spellclass_number")]=s,o["".concat(n,"_spellclass")]=l,o["".concat(n,"_components")]=e._componenttext.replace("Divine Focus","DF").replace("Focus","F").replace("Material","M").replace("Verbal","V").replace("Somatic","S").replace(" or ","/"),o["".concat(n,"_duration")]=e._duration,o["".concat(n,"_save")]=e._save.replace(/DC \d+/,"").trim(),o["".concat(n,"_savedc")]=Wu(e._dc),o["".concat(n,"_cast-time")]=e._casttime,o["".concat(n,"_DC_misc")]=Wu(e._dc)-Wu(t[""!==l?l:Object.keys(t)[0]]._basespelldc)-d,o["".concat(n,"_CL_misc")]=Wu(e._casterlevel)-Wu(t[""!==l?l:Object.keys(t)[0]]._casterlevel),o["".concat(n,"_casterlevel")]=e._casterlevel,-1!==e._resist.toLowerCase().indexOf("yes")?-1!==e._resist.toLowerCase().indexOf("harmless")?o["".concat(n,"_sr")]="Yes (Harmless)":-1!==e._resist.toLowerCase().indexOf("object")?o["".concat(n,"_sr")]="Yes (Object)":o["".concat(n,"_sr")]="Yes":-1!==e._resist.toLowerCase().indexOf("no")?o["".concat(n,"_sr")]="No":o["".concat(n,"_sr")]="",e._range.toLowerCase()){case"close (25 + 5 ft./2 levels)":o["".concat(n,"_range_pick")]="close";break;case"medium (100 + 10 ft./level)":o["".concat(n,"_range_pick")]="medium";break;case"long (400 + 40 ft./level)":o["".concat(n,"_range_pick")]="long";break;case"touch":case"personal":o["".concat(n,"_range_pick")]=e._range.toLowerCase();break;default:o["".concat(n,"_range_pick")]="number",o["".concat(n,"_range")]=e._range}""!==e._area?o["".concat(n,"_targets")]=e._area:""!==e._effect?o["".concat(n,"_targets")]=e._effect:o["".concat(n,"_targets")]=e._target,p=e._schooltext,""!==e._subschooltext&&(p="".concat(p," (").concat(e._subschooltext,")")),""!==e._descriptortext&&(p="".concat(p," [").concat(e._descriptortext,"]")),o["".concat(n,"_school")]=p,o["".concat(n,"_description")]=e.description})),setAttrs(o,{silent:!0},(function(){Ts(),zs()}))}))}))}function Ju(e){var t,a,n={};!function(e,t){t.forEach((function(t){var a=t._name.substr(0,3).toUpperCase(),n=Wu(t.attrvalue._base),r=Wu(t.attrvalue._modified)-n;e["".concat(a,"-base")]=n,e[a]=Wu(t.attrvalue._modified),e["".concat(a,"-mod")]=Wu(t.attrbonus._modified),r>0?(e["".concat(a,"-enhance")]=r,e[a]=Wu(t.attrvalue._modified)):(e["".concat(a,"-penalty")]=r,e[a]=n)}))}(n,e.attributes.attribute),function(e,t){var a=0,n=t.allsaves.situationalmodifiers._text;for(a=0;a<t.save.length;a++){var r=t.save[a],i=r._abbr;e[i]=Wu(r._save),e["class-0-".concat(i)]=e["total-".concat(i)]=Wu(r._base),e["".concat(i,"-resist")]=Wu(r._fromresist),e["".concat(i,"-misc")]=Wu(r._save)-Wu(r._base)-Wu(r._fromresist)-Wu(r._fromattr),e["".concat(i,"-ability-mod")]=Wu(r._fromattr),""!==r.situationalmodifiers._text&&-1===n.indexOf(r.situationalmodifiers._text)&&(n="".concat(n,"\n**").concat(i,":** ").concat(r.situationalmodifiers._text))}e["Save-notes"]=n.trim()}(n,e.saves);var r={};if(!Va.isUndefined(e.classes.class)){if(e.classes.class=Vu(e.classes.class),t=function(e,t,a){for(var n,r=new Object,i=Va.without(Va.map(a.split(";")[a.split(";").length-1].trim().split(/[\+\-]/),(function(e){var t=e.split("d");return t.length<2?null:{dice:t[0],die:t[1]}})),null),s=0;s<t.length;){if(n=t[s],s>=5)return;s>0&&(e["class".concat(s,"_show")]=1),r[n._name.replace(/\(([^\)]*)\)/g,"").replace("(","").replace(")","").trim()]=n,e["class-".concat(s,"-name")]=n._name,e["class-".concat(s,"-level")]=n._level;var c=Va.find(i,(function(e){return e.dice===n._level}));Va.isUndefined(c)||(e["class-".concat(s,"-hd")]=c.die,i=Va.without(i,c)),s++}return i.length>0&&(e["npc-hd"]=i[0].die),r}(n,e.classes.class,e.health._hitdice),!Va.isUndefined(e.spellclasses.spellclass)){n.use_spells=1,e.spellclasses.spellclass=Vu(e.spellclasses.spellclass),a=function(e,t,a,n){var r,i,s,c,o,l,u,p=new Object,d=0,f=0;for(r=0;r<t.length;r++){var m=t[r];if(f>=3)return p;var _=m._name.replace(/\(([^\)]*)\)/g,"").replace("(","").replace(")","").trim(),g=Va.indexOf(Object.keys(a),Va.find(Object.keys(a),(function(e){return-1!==e.toLowerCase().indexOf(_.toLowerCase())})));if(-1!==g){if(o=Wu(a[_]._casterlevel),e["spellclass-".concat(f)]=g,e["spellclass-".concat(f,"-level-misc")]=o-Wu(a[_]._level),e["spellclass-".concat(f,"-level")]=Wu(a[_]._level),e["spellclass-".concat(f,"-level-total")]=o,e["spellclass-".concat(f,"-name")]=a[_]._name.replace(/\(.*\)/g,"").trim(),e["spellclass-".concat(f,"-exists")]=1,e["spellclass-".concat(f,"-close")]=25+5*Math.floor(o/2),e["spellclass-".concat(f,"-medium")]=100+10*o,e["spellclass-".concat(f,"-long")]=400+40*o,Va.isUndefined(a[_].arcanespellfailure)||(e["armor3-spell-fail"]=Wu(a[_].arcanespellfailure._value)),!Va.isUndefined(a[_]._basespelldc))for(d=Wu(a[_]._basespelldc)-10,i=3;i<n.length;i++)if(Wu(n[i].attrbonus._modified)===d){e["Concentration-".concat(f,"-ability")]="".concat(n[i]._name.substr(0,3).toUpperCase(),"-mod");break}if(0!==d){if(Va.isUndefined(a[_]._concentrationcheck)||(l=Wu(a[_]._concentrationcheck)-o-d,e["Concentration-".concat(f,"-misc")]=l,e["Concentration-".concat(f)]=Wu(a[_]._concentrationcheck),e["Concentration-".concat(f,"-mod")]=d),Va.isUndefined(a[_].overcomespellresistance)||(u=Wu(a[_].overcomespellresistance)-o,e["spellclass-".concat(f,"-SP_misc")]=u),!Va.isUndefined(t[r].spelllevel)){for(i=0;i<10;i++)e["spellclass-".concat(f,"-level-").concat(i,"-spells-per-day_max")]=0;for(t[r].spelllevel=Vu(t[r].spelllevel),i=0;i<t[r].spelllevel.length;i++)s=Wu(t[r].spelllevel[i]._maxcasts),c=Wu(t[r].spelllevel[i]._level),e["spellclass-".concat(f,"-level-").concat(c,"-spells-per-day_max")]=s,c>0&&(s-=Gu(d,c)),s<0&&(s=""),e["spellclass-".concat(f,"-level-").concat(c,"-class")]=s}e["spellclass-".concat(f,"-level-1-bonus")]=Gu(d,1),e["spellclass-".concat(f,"-level-2-bonus")]=Gu(d,2),e["spellclass-".concat(f,"-level-3-bonus")]=Gu(d,3),e["spellclass-".concat(f,"-level-4-bonus")]=Gu(d,4),e["spellclass-".concat(f,"-level-5-bonus")]=Gu(d,5),e["spellclass-".concat(f,"-level-6-bonus")]=Gu(d,6),e["spellclass-".concat(f,"-level-7-bonus")]=Gu(d,7),e["spellclass-".concat(f,"-level-8-bonus")]=Gu(d,8),e["spellclass-".concat(f,"-level-9-bonus")]=Gu(d,9)}p[_]=a[Object.keys(a)[g]],f++}}return f>1&&(e.spellclasses_multiclassed=1),p}(n,e.spellclasses.spellclass,t,e.attributes.attribute);var i=Vu(e.spellsknown.spell).concat(Vu(e.spellbook.spell)).concat(Vu(e.spellsmemorized.spell)),s=[];Zu(i=Va.reject(i,(function(e){return!!Va.contains(s,e._name)||(s.concat(e._name),!1)})),a)}r=function(e){var t=new Object;return Va.each(e,(function(e,a){if(-1!==e._name.indexOf("(")){var n=e._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","").split(",");n=Va.map(n,(function(e){return e.trim()})),t[a]=n}else t[a]=[]})),t}(t)}e.penalties.penalty=Vu(e.penalties.penalty);var c=function(e,t){for(var a=0,n=0;n<t.length;)"Armor Check Penalty"===t[n]._name?(a=Wu(t[n]._value),e["armor3-acp"]=a):"Max Dex Bonus"===t[n]._name&&(e["armor3-max-dex"]=Math.min(99,Wu(t[n]._value))),n++;return a}(n,e.penalties.penalty),o={};o.ACP=Wu(n["armor3-acp"]),o.maxDex=Wu(n["armor3-max-dex"]),o.spellfail=Wu(n["armor3-spell-fail"]),function(e,t){e.AC=Wu(t._ac),e.Touch=Wu(t._touch),e["Flat-Footed"]=Wu(t._flatfooted),e["AC-natural"]=Wu(t._fromnatural),e["AC-deflect"]=Wu(t._fromdeflect),e["AC-dodge"]=Wu(t._fromdodge),e["AC-armor"]=Wu(t._fromarmor),e["AC-shield"]=Wu(t._fromshield),""===t._fromdexterity?""!==t._fromcharisma?(e["AC-ability"]="CHA-mod",e["AC-ability-mod"]=e["AC-ability-display"]=Wu(t._fromcharisma),e["AC-misc"]=Wu(t._ac)-10-Wu(t._fromarmor)-Wu(t._fromshield)-Wu(t._fromcharisma)-Wu(t._fromsize)-Wu(t._fromnatural)-Wu(t._fromdeflect)-Wu(t._fromdodge)):""!==t._fromwisdom&&(e["AC-ability"]="WIS-mod",e["AC-ability-mod"]=e["AC-ability-display"]=Wu(t._fromwisdom),e["AC-misc"]=Wu(t._ac)-10-Wu(t._fromarmor)-Wu(t._fromshield)-Wu(t._fromwisdom)-Wu(t._fromsize)-Wu(t._fromnatural)-Wu(t._fromdeflect)-Wu(t._fromdodge)):(e["AC-ability"]="DEX-mod",e["AC-ability-mod"]=e["AC-ability-display"]=Wu(t._fromdexterity),e["AC-misc"]=Wu(t._ac)-10-Wu(t._fromarmor)-Wu(t._fromshield)-Wu(t._fromdexterity)-Wu(t._fromsize)-Wu(t._fromnatural)-Wu(t._fromdeflect)-Wu(t._fromdodge))}(n,e.armorclass),Va.isUndefined(n["armor3-acp"])||delete n["armor3-acp"],Va.isUndefined(n["armor3-spell-fail"])||delete n["armor3-spell-fail"];var l=Va.reject(Vu(e.defenses.armor||{}),(function(e){return Va.isUndefined(e._name)})),u=Va.reject(Vu(e.melee.weapon||{}).concat(Vu(e.ranged.weapon||{})),(function(e){return Va.isUndefined(e._name)})),p=Va.object(Va.map(e.trackedresources.trackedresource,(function(e){return[e._name,e]}))),d=Va.reject(Vu(e.magicitems.item||{}).concat(Vu(e.gear.item||{})),(function(e){return Va.isUndefined(e._name)})),f=Va.map(d,(function(e){return e._name})),m=Va.reject(Vu(e.attack.special).concat(Vu(e.defenses.special),Vu(e.otherspecials.special),Vu(e.movement.special),Vu(e.defensive.special)),(function(e){return Va.contains(f,e._name)}));Ku(d,p,o,l,u),getSectionIDs("repeating_ability",(function(t){var a=Va.union(Va.map(t,(function(e){return"repeating_ability_".concat(e,"_name")})),Va.map(t,(function(e){return"repeating_ability_".concat(e,"_rule_category")})));getAttrs(a,(function(t){var a={},n=Object.keys(t),i={};if(Va.each(n,(function(e){var n;-1!==e.indexOf("_name")&&(n=e.substring(18,e.indexOf("_name")),Va.isUndefined(a[n])&&(a[n]={rowID:n}),a[n].name=t[e]),-1!==e.indexOf("_rule_category")&&(n=e.substring(18,e.indexOf("_rule_category")),Va.isUndefined(a[n])&&(a[n]={rowID:n}),a[n].rulecategory=t[e])})),!Va.isUndefined(e.feats.feat)){var s=Va.filter(a,Va.matcher({rulecategory:"feats"})),c={};Va.each(s,(function(e){c[e.rowID]=e.name})),e.feats.feat=Vu(e.feats.feat),function(e,t,a,n){var r="repeating_ability",i=[],s=Va.map(t,(function(e){return e._name}));Va.each(t,(function(t){if(!Va.contains(i,t._name)){var c=Va.filter(s,(function(e){return e===t._name})).length,o=$u(a,t._name);Va.isUndefined(a[o])||delete a[o],e["".concat(r,"_").concat(o,"_name")]=c>1?"".concat(t._name," x").concat(c):t._name,e["".concat(r,"_").concat(o,"_description")]=t.description,e["".concat(r,"_").concat(o,"_tabcat")]=e["".concat(r,"_").concat(o,"_rule_category")]="feats",i.push(t._name),Va.contains(Object.keys(n),t._name)&&(e["".concat(r,"_").concat(o,"_max-calculation")]=n[t._name]._max)}}))}(i,e.feats.feat,c,p)}if(!Va.isUndefined(e.traits.trait)){var o=Va.filter(a,Va.matcher({rulecategory:"traits"})),l={};Va.each(o,(function(e){l[e.rowID]=e.name})),e.traits.trait=Vu(e.traits.trait),function(e,t,a,n){var r="repeating_ability";t.forEach((function(t){var i=$u(a,t._name);Va.isUndefined(a[i])||delete a[i],e["".concat(r,"_").concat(i,"_name")]=t._name,e["".concat(r,"_").concat(i,"_description")]=t.description,e["".concat(r,"_").concat(i,"_tabcat")]=e["".concat(r,"_").concat(i,"_rule_category")]="traits",Va.contains(Object.keys(n),t._name)&&(e["".concat(r,"_").concat(i,"_max-calculation")]=n[t._name]._max)}))}(i,e.traits.trait,l,p)}if(!Va.isUndefined(e.spelllike.special)){var u=Va.filter(a,Va.matcher({rulecategory:"spell-like-abilities"})),d={};Va.each(u,(function(e){d[e.rowID]=e.name})),e.spelllike.special=Vu(e.spelllike.special),function(e,t,a,n){var r="repeating_ability";t.forEach((function(t){var i=$u(a,t._name);Va.isUndefined(a[i])||delete a[i],e["".concat(r,"_").concat(i,"_name")]=t._name,e["".concat(r,"_").concat(i,"_description")]=t.description,e["".concat(r,"_").concat(i,"_tabcat")]=e["".concat(r,"_").concat(i,"_rule_category")]="spell-like-abilities",e["".concat(r,"_").concat(i,"_tabcat2")]=e["".concat(r,"_").concat(i,"_ability_type")]="Sp",Va.contains(Object.keys(n),t._name)&&(e["".concat(r,"_").concat(i,"_max-calculation")]=n[t._name]._max)}))}(i,e.spelllike.special,d,p)}var f=Va.filter(a,(function(e){return"traits"!==e.rulecategory&&"feats"!==e.rulecategory})),_={};Va.each(f,(function(e){_[e.rowID]=e})),Yu(i,_,m,r,p),setAttrs(i,{silent:!0})}))})),n.experience=parseFloat(e.xp._total),n["class-0-bab"]=n.bab=n["melee_bab-mod"]=n["melee2_bab-mod"]=n["ranged_bab-mod"]=n["ranged2_bab-mod"]=n["melee_bab-mod"]=n["cmb_bab-mod"]=n["cmb2_bab-mod"]=Wu(e.attack._baseattack),n["non-lethal-damage_max"]=n.HP_max=Wu(e.health._hitpoints);var _=function(e){for(var t=e.match(/\d+d\d/g),a=0,n=0;n<t.length;)a+=parseInt(t[n].split("d")[0]),n++;return a}(e.health._hitdice);n.level=_,n["HP-ability-mod"]=Wu(e.attributes.attribute[2].attrbonus._modified),n.hp_ability_bonus=_*Wu(e.attributes.attribute[2].attrbonus._modified),n["total-hp"]=n["class-0-hp"]=Wu(e.health._hitpoints)-_*Wu(e.attributes.attribute[2].attrbonus._modified),function(e,t){e.init=Wu(t._total),e["init-misc"]=Wu(t._total)-Wu(t._attrtext),e["init-ability"]="".concat(t._attrname.substr(0,3).toUpperCase(),"-mod"),e["init-ability-mod"]=Wu(t._attrtext),e.init_notes=t.situationalmodifiers._text}(n,e.initiative);var g=_-Wu(e.classes._level);g>0&&(n.add_race=1,n["npc-hd-num"]=g);var b=function(e){switch(e.toLowerCase()){case"colossal":return-8;case"gargantuan":return-4;case"huge":return-2;case"large":return-1;case"small":return 1;case"tiny":return 2;case"diminutive":return 4;case"fine":return 8;default:return 0}}(e.size._name);if(n.size=b,n.default_char_size=b,n["CMD-size"]=-1*b,e.skills.skill=Vu(e.skills.skill),function(e,t,a,n){var r;switch(Math.abs(a)){case 0:default:r=0;break;case 1:r=2;break;case 2:r=4;break;case 4:r=6;break;case 8:r=8;break;case 16:r=10}a<0&&(r*=-1),Va.extend(e,{"acrobatics-ability":"","acrobatics-cs":"","acrobatics-ranks":"","acrobatics-class":"","acrobatics-ability-mod":"","acrobatics-racial":"","acrobatics-feat":"","acrobatics-item":"","acrobatics-size":"","acrobatics-acp":"","acrobatics-misc":"","acrobatics-reqtrain":"","artistry-ability":"","artistry-cs":"","artistry-ranks":"","artistry-class":"","artistry-ability-mod":"","artistry-racial":"","artistry-feat":"","artistry-item":"","artistry-size":"","artistry-acp":"","artistry-misc":"","artistry-reqtrain":"","artistry2-ability":"","artistry2-cs":"","artistry2-ranks":"","artistry2-class":"","artistry2-ability-mod":"","artistry2-racial":"","artistry2-feat":"","artistry2-item":"","artistry2-size":"","artistry2-acp":"","artistry2-misc":"","artistry2-reqtrain":"","artistry3-ability":"","artistry3-cs":"","artistry3-ranks":"","artistry3-class":"","artistry3-ability-mod":"","artistry3-racial":"","artistry3-feat":"","artistry3-item":"","artistry3-size":"","artistry3-acp":"","artistry3-misc":"","artistry3-reqtrain":"","appraise-ability":"","appraise-cs":"","appraise-ranks":"","appraise-class":"","appraise-ability-mod":"","appraise-racial":"","appraise-feat":"","appraise-item":"","appraise-size":"","appraise-acp":"","appraise-misc":"","appraise-reqtrain":"","bluff-ability":"","bluff-cs":"","bluff-ranks":"","bluff-class":"","bluff-ability-mod":"","bluff-racial":"","bluff-feat":"","bluff-item":"","bluff-size":"","bluff-acp":"","bluff-misc":"","bluff-reqtrain":"","climb-ability":"","climb-cs":"","climb-ranks":"","climb-class":"","climb-ability-mod":"","climb-racial":"","climb-feat":"","climb-item":"","climb-size":"","climb-acp":"","climb-misc":"","climb-reqtrain":"","craft-ability":"","craft-cs":"","craft-ranks":"","craft-class":"","craft-ability-mod":"","craft-racial":"","craft-feat":"","craft-item":"","craft-size":"","craft-acp":"","craft-misc":"","craft-reqtrain":"","craft2-ability":"","craft2-cs":"","craft2-ranks":"","craft2-class":"","craft2-ability-mod":"","craft2-racial":"","craft2-feat":"","craft2-item":"","craft2-size":"","craft2-acp":"","craft2-misc":"","craft2-reqtrain":"","craft3-ability":"","craft3-cs":"","craft3-ranks":"","craft3-class":"","craft3-ability-mod":"","craft3-racial":"","craft3-feat":"","craft3-item":"","craft3-size":"","craft3-acp":"","craft3-misc":"","craft3-reqtrain":"","diplomacy-ability":"","diplomacy-cs":"","diplomacy-ranks":"","diplomacy-class":"","diplomacy-ability-mod":"","diplomacy-racial":"","diplomacy-feat":"","diplomacy-item":"","diplomacy-size":"","diplomacy-acp":"","diplomacy-misc":"","diplomacy-reqtrain":"","disable-device-ability":"","disable-device-cs":"","disable-device-ranks":"","disable-device-class":"","disable-device-ability-mod":"","disable-device-racial":"","disable-device-feat":"","disable-device-item":"","disable-device-size":"","disable-device-acp":"","disable-device-misc":"","disable-device-reqtrain":"","disguise-ability":"","disguise-cs":"","disguise-ranks":"","disguise-class":"","disguise-ability-mod":"","disguise-racial":"","disguise-feat":"","disguise-item":"","disguise-size":"","disguise-acp":"","disguise-misc":"","disguise-reqtrain":"","escape-artist-ability":"","escape-artist-cs":"","escape-artist-ranks":"","escape-artist-class":"","escape-artist-ability-mod":"","escape-artist-racial":"","escape-artist-feat":"","escape-artist-item":"","escape-artist-size":"","escape-artist-acp":"","escape-artist-misc":"","escape-artist-reqtrain":"","fly-ability":"","fly-cs":"","fly-ranks":"","fly-class":"","fly-ability-mod":"","fly-racial":"","fly-feat":"","fly-item":"","fly-size":"","fly-acp":"","fly-misc":"","fly-reqtrain":"","handle-animal-ability":"","handle-animal-cs":"","handle-animal-ranks":"","handle-animal-class":"","handle-animal-ability-mod":"","handle-animal-racial":"","handle-animal-feat":"","handle-animal-item":"","handle-animal-size":"","handle-animal-acp":"","handle-animal-misc":"","handle-animal-reqtrain":"","heal-ability":"","heal-cs":"","heal-ranks":"","heal-class":"","heal-ability-mod":"","heal-racial":"","heal-feat":"","heal-item":"","heal-size":"","heal-acp":"","heal-misc":"","heal-reqtrain":"","intimidate-ability":"","intimidate-cs":"","intimidate-ranks":"","intimidate-class":"","intimidate-ability-mod":"","intimidate-racial":"","intimidate-feat":"","intimidate-item":"","intimidate-size":"","intimidate-acp":"","intimidate-misc":"","intimidate-reqtrain":"","linguistics-ability":"","linguistics-cs":"","linguistics-ranks":"","linguistics-class":"","linguistics-ability-mod":"","linguistics-racial":"","linguistics-feat":"","linguistics-item":"","linguistics-size":"","linguistics-acp":"","linguistics-misc":"","linguistics-reqtrain":"","lore-ability":"","lore-cs":"","lore-ranks":"","lore-class":"","lore-ability-mod":"","lore-racial":"","lore-feat":"","lore-item":"","lore-size":"","lore-acp":"","lore-misc":"","lore-reqtrain":"","lore2-ability":"","lore2-cs":"","lore2-ranks":"","lore2-class":"","lore2-ability-mod":"","lore2-racial":"","lore2-feat":"","lore2-item":"","lore2-size":"","lore2-acp":"","lore2-misc":"","lore2-reqtrain":"","lore3-ability":"","lore3-cs":"","lore3-ranks":"","lore3-class":"","lore3-ability-mod":"","lore3-racial":"","lore3-feat":"","lore3-item":"","lore3-size":"","lore3-acp":"","lore3-misc":"","lore3-reqtrain":"","knowledge-arcana-ability":"","knowledge-arcana-cs":"","knowledge-arcana-ranks":"","knowledge-arcana-class":"","knowledge-arcana-ability-mod":"","knowledge-arcana-racial":"","knowledge-arcana-feat":"","knowledge-arcana-item":"","knowledge-arcana-size":"","knowledge-arcana-acp":"","knowledge-arcana-misc":"","knowledge-arcana-reqtrain":"","knowledge-dungeoneering-ability":"","knowledge-dungeoneering-cs":"","knowledge-dungeoneering-ranks":"","knowledge-dungeoneering-class":"","knowledge-dungeoneering-ability-mod":"","knowledge-dungeoneering-racial":"","knowledge-dungeoneering-feat":"","knowledge-dungeoneering-item":"","knowledge-dungeoneering-size":"","knowledge-dungeoneering-acp":"","knowledge-dungeoneering-misc":"","knowledge-dungeoneering-reqtrain":"","knowledge-engineering-ability":"","knowledge-engineering-cs":"","knowledge-engineering-ranks":"","knowledge-engineering-class":"","knowledge-engineering-ability-mod":"","knowledge-engineering-racial":"","knowledge-engineering-feat":"","knowledge-engineering-item":"","knowledge-engineering-size":"","knowledge-engineering-acp":"","knowledge-engineering-misc":"","knowledge-engineering-reqtrain":"","knowledge-geography-ability":"","knowledge-geography-cs":"","knowledge-geography-ranks":"","knowledge-geography-class":"","knowledge-geography-ability-mod":"","knowledge-geography-racial":"","knowledge-geography-feat":"","knowledge-geography-item":"","knowledge-geography-size":"","knowledge-geography-acp":"","knowledge-geography-misc":"","knowledge-geography-reqtrain":"","knowledge-history-ability":"","knowledge-history-cs":"","knowledge-history-ranks":"","knowledge-history-class":"","knowledge-history-ability-mod":"","knowledge-history-racial":"","knowledge-history-feat":"","knowledge-history-item":"","knowledge-history-size":"","knowledge-history-acp":"","knowledge-history-misc":"","knowledge-history-reqtrain":"","knowledge-local-ability":"","knowledge-local-cs":"","knowledge-local-ranks":"","knowledge-local-class":"","knowledge-local-ability-mod":"","knowledge-local-racial":"","knowledge-local-feat":"","knowledge-local-item":"","knowledge-local-size":"","knowledge-local-acp":"","knowledge-local-misc":"","knowledge-local-reqtrain":"","knowledge-nature-ability":"","knowledge-nature-cs":"","knowledge-nature-ranks":"","knowledge-nature-class":"","knowledge-nature-ability-mod":"","knowledge-nature-racial":"","knowledge-nature-feat":"","knowledge-nature-item":"","knowledge-nature-size":"","knowledge-nature-acp":"","knowledge-nature-misc":"","knowledge-nature-reqtrain":"","knowledge-nobility-ability":"","knowledge-nobility-cs":"","knowledge-nobility-ranks":"","knowledge-nobility-class":"","knowledge-nobility-ability-mod":"","knowledge-nobility-racial":"","knowledge-nobility-feat":"","knowledge-nobility-item":"","knowledge-nobility-size":"","knowledge-nobility-acp":"","knowledge-nobility-misc":"","knowledge-nobility-reqtrain":"","knowledge-planes-ability":"","knowledge-planes-cs":"","knowledge-planes-ranks":"","knowledge-planes-class":"","knowledge-planes-ability-mod":"","knowledge-planes-racial":"","knowledge-planes-feat":"","knowledge-planes-item":"","knowledge-planes-size":"","knowledge-planes-acp":"","knowledge-planes-misc":"","knowledge-planes-reqtrain":"","knowledge-religion-ability":"","knowledge-religion-cs":"","knowledge-religion-ranks":"","knowledge-religion-class":"","knowledge-religion-ability-mod":"","knowledge-religion-racial":"","knowledge-religion-feat":"","knowledge-religion-item":"","knowledge-religion-size":"","knowledge-religion-acp":"","knowledge-religion-misc":"","knowledge-religion-reqtrain":"","perception-ability":"","perception-cs":"","perception-ranks":"","perception-class":"","perception-ability-mod":"","perception-racial":"","perception-feat":"","perception-item":"","perception-size":"","perception-acp":"","perception-misc":"","perception-reqtrain":"","perform-ability":"","perform-cs":"","perform-ranks":"","perform-class":"","perform-ability-mod":"","perform-racial":"","perform-feat":"","perform-item":"","perform-size":"","perform-acp":"","perform-misc":"","perform-reqtrain":"","perform2-ability":"","perform2-cs":"","perform2-ranks":"","perform2-class":"","perform2-ability-mod":"","perform2-racial":"","perform2-feat":"","perform2-item":"","perform2-size":"","perform2-acp":"","perform2-misc":"","perform2-reqtrain":"","perform3-ability":"","perform3-cs":"","perform3-ranks":"","perform3-class":"","perform3-ability-mod":"","perform3-racial":"","perform3-feat":"","perform3-item":"","perform3-size":"","perform3-acp":"","perform3-misc":"","perform3-reqtrain":"","profession-ability":"","profession-cs":"","profession-ranks":"","profession-class":"","profession-ability-mod":"","profession-racial":"","profession-feat":"","profession-item":"","profession-size":"","profession-acp":"","profession-misc":"","profession-reqtrain":"","profession2-ability":"","profession2-cs":"","profession2-ranks":"","profession2-class":"","profession2-ability-mod":"","profession2-racial":"","profession2-feat":"","profession2-item":"","profession2-size":"","profession2-acp":"","profession2-misc":"","profession2-reqtrain":"","profession3-ability":"","profession3-cs":"","profession3-ranks":"","profession3-class":"","profession3-ability-mod":"","profession3-racial":"","profession3-feat":"","profession3-item":"","profession3-size":"","profession3-acp":"","profession3-misc":"","profession3-reqtrain":"","ride-ability":"","ride-cs":"","ride-ranks":"","ride-class":"","ride-ability-mod":"","ride-racial":"","ride-feat":"","ride-item":"","ride-size":"","ride-acp":"","ride-misc":"","ride-reqtrain":"","sense-motive-ability":"","sense-motive-cs":"","sense-motive-ranks":"","sense-motive-class":"","sense-motive-ability-mod":"","sense-motive-racial":"","sense-motive-feat":"","sense-motive-item":"","sense-motive-size":"","sense-motive-acp":"","sense-motive-misc":"","sense-motive-reqtrain":"","sleight-of-hand-ability":"","sleight-of-hand-cs":"","sleight-of-hand-ranks":"","sleight-of-hand-class":"","sleight-of-hand-ability-mod":"","sleight-of-hand-racial":"","sleight-of-hand-feat":"","sleight-of-hand-item":"","sleight-of-hand-size":"","sleight-of-hand-acp":"","sleight-of-hand-misc":"","sleight-of-hand-reqtrain":"","spellcraft-ability":"","spellcraft-cs":"","spellcraft-ranks":"","spellcraft-class":"","spellcraft-ability-mod":"","spellcraft-racial":"","spellcraft-feat":"","spellcraft-item":"","spellcraft-size":"","spellcraft-acp":"","spellcraft-misc":"","spellcraft-reqtrain":"","stealth-ability":""," stealth-cs":"","stealth-ranks":"","stealth-class":"","stealth-ability-mod":"","stealth-racial":"","stealth-feat":"","stealth-item":"","stealth-size":"","stealth-acp":"","stealth-misc":"","stealth-reqtrain":"","survival-ability":"","survival-cs":"","survival-ranks":"","survival-class":"","survival-ability-mod":"","survival-racial":"","survival-feat":"","survival-item":"","survival-size":"","survival-acp":"","survival-misc":"","survival-reqtrain":"","swim-ability":"","swim-cs":"","swim-ranks":"","swim-class":"","swim-ability-mod":"","swim-racial":"","swim-feat":"","swim-item":"","swim-size":"","swim-acp":"","swim-misc":"","swim-reqtrain":"","use-magic-device-ability":"","use-magic-device-cs":"","use-magic-device-ranks":"","use-magic-device-class":"","use-magic-device-ability-mod":"","use-magic-device-racial":"","use-magic-device-feat":"","use-magic-device-item":"","use-magic-device-size":"","use-magic-device-acp":"","use-magic-device-misc":"","use-magic-device-reqtrain":"","misc-skill-0-ability":"","misc-skill-0-cs":"","misc-skill-0-ranks":"","misc-skill-0-class":"","misc-skill-0-ability-mod":"","misc-skill-0-racial":"","misc-skill-0-feat":"","misc-skill-0-item":"","misc-skill-0-size":"","misc-skill-0-acp":"","misc-skill-0-misc":"","misc-skill-0-reqtrain":"","misc-skill-1-ability":"","misc-skill-1-cs":"","misc-skill-1-ranks":"","misc-skill-1-class":"","misc-skill-1-ability-mod":"","misc-skill-1-racial":"","misc-skill-1-feat":"","misc-skill-1-item":"","misc-skill-1-size":"","misc-skill-1-acp":"","misc-skill-1-misc":"","misc-skill-1-reqtrain":"","misc-skill-2-ability":"","misc-skill-2-cs":"","misc-skill-2-ranks":"","misc-skill-2-class":"","misc-skill-2-ability-mod":"","misc-skill-2-racial":"","misc-skill-2-feat":"","misc-skill-2-item":"","misc-skill-2-size":"","misc-skill-2-acp":"","misc-skill-2-misc":"","misc-skill-2-reqtrain":"","misc-skill-3-ability":"","misc-skill-3-cs":"","misc-skill-3-ranks":"","misc-skill-3-class":"","misc-skill-3-ability-mod":"","misc-skill-3-racial":"","misc-skill-3-feat":"","misc-skill-3-item":"","misc-skill-3-size":"","misc-skill-3-acp":"","misc-skill-3-misc":"","misc-skill-3-reqtrain":"","misc-skill-4-ability":"","misc-skill-4-cs":"","misc-skill-4-ranks":"","misc-skill-4-class":"","misc-skill-4-ability-mod":"","misc-skill-4-racial":"","misc-skill-4-feat":"","misc-skill-4-item":"","misc-skill-4-size":"","misc-skill-4-acp":"","misc-skill-4-misc":"","misc-skill-4-reqtrain":"","misc-skill-5-ability":"","misc-skill-5-cs":"","misc-skill-5-ranks":"","misc-skill-5-class":"","misc-skill-5-ability-mod":"","misc-skill-5-racial":"","misc-skill-5-feat":"","misc-skill-5-item":"","misc-skill-5-size":"","misc-skill-5-acp":"","misc-skill-5-misc":"","misc-skill-5-reqtrain":"","craft-name":"","craft2-name":"","craft3-name":"","lore-name":"","perform-name":"","perform2-name":"","perform3-name":"","profession-name":"","profession2-name":"","profession3-name":"","misc-skill-0-name":"","misc-skill-1-name":"","misc-skill-2-name":"","misc-skill-3-name":"","misc-skill-4-name":"","misc-skill-5-name":""});var i,s,c,o=1,l=1,u=1,p=1,d=1,f=0,m=0;for(m=0;m<t.length;m++){if(-1!==(i=t[m])._name.indexOf("Craft"))1===o?(c="craft",null!==i._name.match(/\(([^\)]*)\)/)&&(e["craft-name"]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","")),o++):o<=10?(c="craft".concat(o),null!==i._name.match(/\(([^\)]*)\)/)&&(e["craft".concat(o,"-name")]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","")),o++):f<=10?(c="misc-skill-".concat(f),null!==i._name.match(/\(([^\)]*)\)/)&&(e["".concat(c,"-name")]=i._name),f++):console.log("Ran out of misc skills for ".concat(i._name,"!"));else if(-1!==i._name.indexOf("Perform"))1===l?(c="perform",null!==i._name.match(/\(([^\)]*)\)/)&&(e["perform-name"]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","")),l++):l<=10?(c="perform".concat(l),null!==i._name.match(/\(([^\)]*)\)/)&&(e["perform".concat(l,"-name")]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","")),l++):f<=10?(c="misc-skill-".concat(f),null!==i._name.match(/\(([^\)]*)\)/)&&(e["".concat(c,"-name")]=i._name),f++):console.log("Ran out of misc skills for ".concat(i._name,"!"));else if(-1!==i._name.indexOf("Profession"))1===u?(c="profession",null!==i._name.match(/\(([^\)]*)\)/)&&(e["profession-name"]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","")),u++):u<=10?(c="profession".concat(u),null!==i._name.match(/\(([^\)]*)\)/)&&(e["profession".concat(u,"-name")]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")","")),u++):f<=10?(c="misc-skill-".concat(f),null!==i._name.match(/\(([^\)]*)\)/)&&(e["".concat(c,"-name")]=i._name),f++):console.log("Ran out of misc skills for ".concat(i._name,"!"));else if(-1!==i._name.indexOf("Knowledge"))switch(i._name.match(/\(([^\)]*)\)/g)[0]){case"(arcana)":case"(dungeoneering)":case"(engineering)":case"(geography)":case"(history)":case"(local)":case"(nature)":case"(nobility)":case"(planes)":case"(religion)":c=i._name.toLowerCase().replace(/\s/g,"-").replace("(","").replace(")","");break;default:c="misc-skill-".concat(f),e["".concat(c,"-name")]=i._name,f++}else-1!==i._name.indexOf("Artistry")?1===p?(c="artistry",e["artistry-name"]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")",""),p++):p<=10?(c="artistry".concat(p),e["artistry".concat(p,"-name")]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")",""),p++):f<=10?(c="misc-skill-".concat(f),e["".concat(c,"-name")]=i._name,f++):console.log("Ran out of misc skills for ".concat(i._name,"!")):-1!==i._name.indexOf("Lore")?1===d?(c="lore",e["lore-name"]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")",""),d++):d<=10?(c="lore".concat(d),e["lore".concat(d,"-name")]=i._name.match(/\(([^\)]*)\)/)[0].replace("(","").replace(")",""),d++):f<=10?(c="misc-skill-".concat(f),e["".concat(c,"-name")]=i._name,f++):console.log("Ran out of misc skills for ".concat(i._name,"!")):c=i._name.toLowerCase().replace(/\s/g,"-").replace("(","").replace(")","").replace("-hand","-Hand").replace("e-device","e-Device").replace("-artist","-Artist").replace("-animal","-Animal");if(e[c]=Wu(i._value),e["".concat(c,"-ranks")]=Wu(i._ranks),e["".concat(c,"-ability")]="".concat(i._attrname,"-mod"),e["".concat(c,"-ability-mod")]=Wu(i._attrbonus),"yes"===i._classskill&&(e["".concat(c,"-cs")]=3),s=Wu(i._value)-Wu(i._ranks)-Wu(i._attrbonus),0!==Wu(i._ranks)&&"yes"===i._classskill&&(s-=3),"yes"===i._armorcheck&&(s-=n),"Fly"===i._name&&(s-=r),"Stealth"===i._name&&(s-=2*r),e["".concat(c,"-misc")]=s,"yes"===i._trainedonly&&(e["".concat(c,"-ReqTrain")]=1),!Va.isUndefined(i.situationalmodifiers.situationalmodifier)){var _="";i.situationalmodifiers.situationalmodifier=Vu(i.situationalmodifiers.situationalmodifier);for(var g=0;g<i.situationalmodifiers.situationalmodifier.length;)_="".concat(_,"}} {{").concat(i.situationalmodifiers.situationalmodifier[g]._source,"=").concat(i.situationalmodifiers.situationalmodifier[g]._text),g++;e["".concat(c,"-note")]=_}}var b=Math.max(o,l,u,p,d);e.custom_skill_num_show=b>6?10:b>3?6:b>2?3:b>2?2:1,e.misc_skill_num_show=f>6?10:f>3?6:f>2?3:f>2?2:1}(n,e.skills.skill,b,c),Va.isUndefined(e.senses.special)||(e.senses.special=Vu(e.senses.special),n.vision=Xu(e.senses.special,"_shortname")),Va.isUndefined(e.damagereduction.special)||(e.damagereduction.special=Vu(e.damagereduction.special),n.DR=Xu(e.damagereduction.special,"_shortname")),Va.isUndefined(e.resistances.special)||(e.resistances.special=Vu(e.resistances.special),n.resistances=Xu(e.resistances.special,"_shortname")),Va.isUndefined(e.immunities.special)||(e.immunities.special=Vu(e.immunities.special),n.immunities=Xu(e.immunities.special,"_shortname")),Va.isUndefined(e.weaknesses.special)||(e.weaknesses.special=Vu(e.weaknesses.special),n.weaknesses=Xu(e.weaknesses.special,"_shortname")),Va.isUndefined(e.languages.language)||(e.languages.language=Vu(e.languages.language),n.languages=Xu(e.languages.language,"_name")),n["npc-type"]=Vu(e.types.type)[0]._name,Va.isUndefined(e.subtypes.subtype)||(n["npc-type"]="".concat(n["npc-type"]," (").concat(Xu(Vu(e.subtypes.subtype),"_name"),")")),n.character_name=e._name,"pc"!==e._role&&(n.is_npc=1,n.tab=8,Va.isUndefined(e.npc.ecology.npcinfo)||(n.environment=Vu(e.npc.ecology.npcinfo)[0].text||"",n.organization=Vu(e.npc.ecology.npcinfo)[1].text||"",n.other_items_treasure=Vu(e.npc.ecology.npcinfo)[2].text||""),Va.isUndefined(e.npc.tactics)||(n["npc-during-combat"]=e.npc.tactics||"")),n["player-name"]=e._playername,n.deity=e.deity._name,n.race=e.race._racetext.substr(0,1).toUpperCase()+e.race._racetext.substr(1,1e3),n.alignment=e.alignment._name,n.gender=e.personal._gender,n.age=e.personal._age,n.height=e.personal.charheight._text,n.weight=e.personal.charweight._text,n.hair=e.personal._hair,n.eyes=e.personal._eyes,n.skin=e.personal._skin,n.character_description="pc"!==e._role?e.npc.description:e.personal.description,n["npc-cr"]=e.challengerating._text.replace("CR ",""),n["npc-xp"]=e.xpaward._value,n["speed-base"]=n["speed-modified"]=Wu(e.movement.speed._value),n.cmb=Wu(e.maneuvers._total),n.cmd=Wu(e.maneuvers._cmd),n["ff-cmd"]=Wu(e.maneuvers._cmdflatfooted),n["cmd-str"]=n["STR-mod"],n["cmd-misc"]=n.cmd-10-n["AC-ability-mod"]-n["cmd-str"]-n["CMD-size"]-n["AC-dodge"]-n["AC-deflect"]-n.bab,n["attk-melee"]=Wu(e.attack._meleeattack.split("/")[0]),n["attk-ranged"]=n["attk-melee2"]=Wu(e.attack._rangedattack.split("/")[0]),Va.isUndefined(e.favoredclasses.favoredclass)||(e.favoredclasses.favoredclass=Vu(e.favoredclasses.favoredclass),n["class-favored"]=Xu(e.favoredclasses.favoredclass,"_name")),n["other-PP"]=e.money._pp,n["other-GP"]=e.money._gp,n["other-SP"]=e.money._sp,n["other-CP"]=e.money._cp,n["load-str-bonus"]=Wu(e.encumbrance._encumstr)-n.STR,n["load-light"]=e.encumbrance._light,n["load-medium"]=e.encumbrance._medium,n["load-heavy"]=n["lift-above-head"]=e.encumbrance._heavy,n["load-max"]=n["lift-off-ground"]=2*Wu(e.encumbrance._heavy),n["lift-drag-and-push"]=5*Wu(e.encumbrance._heavy),Va.isUndefined(e.pathfindersociety)||(n.set_pfs=1,Sl(null)),!Va.isUndefined(e.factions.faction)){var h=Va.find(Vu(e.factions.faction),(function(e){return Va.isUndefined(e._retired)}));Va.isUndefined(h)||(n.prestige=h._cpa,n.fame=h._tpa,n.faction_notes=h._name)}setAttrs(n,{silent:!0})}on("change:create_kineticblast_macro",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["create_kineticblast_macro"],(function(e){parseInt(e.create_kineticblast_macro,10)&&getAttrs(["kineticblast_attack_type","kineticblast_type","kineticblast_damage_type","use_devastating_infusion"],(function(e){var t,a="",n="",r="",i=0,s="6",c={};t=parseInt(e.use_devastating_infusion,10)||0,"composite"===e.kineticblast_type&&(i=1),!t||"ranged"!==e.kineticblast_attack_type&&"energy"!==e.kineticblast_damage_type?(a="@{kineticblast_attack-mod}+@{buff_kineticblast-total}",t?(s="8",r="@{kineticist_level-mod}"):r="floor((@{kineticist_level-mod}+1)/2)",i&&(r="2*"+r),n="[[ "+r+" ]]d"+s,t?n+="+ @{kineticist_ability-mod}":"physical"===e.kineticblast_damage_type?n=n+"+ [[ "+r+" ]] + @{kineticist_ability-mod}":n+="+ [[ floor(@{kineticist_ability-mod}/2) ]]",n+="+@{kineticblast_dmg-mod}","ranged"===e.kineticblast_attack_type&&(n+="+@{buff_dmg_kineticblast-total}")):(n="INVALID",a="INVALID"),c.kineticblast_tempattack=a,c.kineticblast_tempdmg="[[ "+n+" ]]",c.create_kineticblast_macro=0,Ja(c,o.silentParams)}))})))}))),on("change:kineticist_level-mod change:kineticist_ability-mod",n().callback((function(e){"sheetworker"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),Ou(null))}))),on("change:use_burn",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),qu())}))),on("change:create_kineticblast_attack",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["adv_macro_show","create_kineticblast_attack","kineticblast_attack_type","kineticblast_type","kineticblast_damage_type","kineticblast_tempattack","kineticblast_tempdmg"],(function(e){var t="",a="",r={},i="",s="";if(parseInt(e.create_kineticblast_attack,10))try{t="repeating_weapon_"+(a=generateRowID())+"_",i=e.kineticblast_type+"-"+e.kineticblast_damage_type+"-",i=(i=Qa(i+="ranged"===e.kineticblast_attack_type?"blast":"blade")).replace("-"," "),r[t+"name"]=i,"physical"===e.kineticblast_damage_type?(r[t+"vs"]="AC",s=Qa("physical")):(r[t+"vs"]="touch",s=Qa("energy")),parseInt(e.adv_macro_show)?r[t+"attack_macro_insert"]=e.kineticblast_tempattack:r[t+"attack"]=e.kineticblast_tempattack,"ranged"===e.kineticblast_attack_type?(r[t+"attack-type"]="attk-ranged",r[t+"range"]="@{kineticblast_range}",r[t+"isranged"]=1):r[t+"attack-type"]="attk-melee",r[t+"precision_dmg_macro"]=e.kineticblast_tempdmg,r[t+"precision_dmg_type"]=s,r[t+"critical_dmg_macro"]=e.kineticblast_tempdmg,r[t+"critical_dmg_type"]=s,r[t+"notes"]="DC [[@{kineticblast_dc}]] (if applicable)",r[t+"default_damage-dice-num"]=0,r[t+"default_damage-die"]=0,r[t+"damage-dice-num"]=0,r[t+"damage-die"]=0,r[t+"size_affects"]=0,r[t+"damage-ability"]="0"}catch(t){n().error("PFAttacks.createAttack err creating "+e.kineticblast_attack_type,t)}finally{Va.size(r)?(r.create_kineticblast_attack=0,Ja(r,o.silentParams,(function(){Co(a,(function(){Tr(),mr(a)}))}))):Ja({create_kineticblast_attack:0},o.silentParams)}})))}))),on("change:kineticistburn",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["non-lethal-damage","kineticistburn","oldkineticistburn","level"],(function(e){var t=0,a=0,r=0,i=0,s=0,c=0,o={};try{(a=parseInt(e.oldkineticistburn,10)||0)!==(r=parseInt(e.kineticistburn,10)||0)&&(o.oldkineticistburn=r,t=parseInt(e["non-lethal-damage"],10)||0,s=(r-a||0)*(i=parseInt(e.level,10)||0),n().debug("PFOccult.change:kineticistburn level:"+i+", newdmg:"+s+", curr nld:"+t,e),(c=t+s)<0&&(c=0),o["non-lethal-damage"]=c)}catch(e){n().error("PFOccult.change:kineticistburn kineticburn",e)}finally{Va.size(o)&&Ja(o)}})))}))),on("sheet:opened",n().callback((function(){ju()}))),on("change:recalc1 change:migrate1",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||ju()}))),on("change:expandall",(function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["expandall"],(function(e){parseInt(e.expandall,10)&&(Ja({expandall:"0",pagetab:"99",buffs_tab:"99",abilities_tab:"99","npc-abilities_tab":"99",skills_tab:"99",spellclass_tab:"99",spells_tab:"99",npc_spellclass_tab:"99",equipment_tab:"99","conditions-show":1,"buffstop-show":1,"command-buttons-show":1,"NPC-command-buttons-show":1,"character-details-show":1,"ability-scores-show":1,"class-info-show":1,class1_show:1,class2_show:1,class3_show:1,"health-and-wounds-show":1,"initiative-show":1,"macro-text-show":1,"notes-show":1,"saves-show":1,"all-saves-macro-show":1,"save-notes-show":1,"defense-values-show":1,"armor-shield-show":1,"sanity-show":1,"defense-notes-show":1,"attack-bonuses-show":1,atkm2_show:1,ranged_2_show:1,cmb_2_show:1,"attack-notes-show":1,"attack-options-show":1,"two-weapon-show":1,"attacks-show":1,"skill-ranks-show":1,"skill_options-show":1,"skills-show":1,"artistry-show":1,"craft-show":1,"knowledge-show":1,"lore-show":1,"perform-show":1,"profession-show":1,"misc-show":1,"skill-notes-show":1,"ability-command-buttons-show":1,"NPC-ability-command-buttons-show":1,"feats-show":1,"mythic-info-show":1,"psionic-info-show":1,"burn-show":1,"abilities-show":1,"spellclasses-show":1,"spellclass-0-show":1,"spellclass-0-spellpoints-show":1,"spellclass-0-spells-notes-show":1,"spellclass-0-perday-show":1,"spellclass-0-domains-show":1,domain02_show:1,domain03_show:1,"spellclass-1-show":1,"spellclass-1-spellpoints-show":1,"spellclass-1-spells-notes-show":1,"spellclass-1-perday-show":1,"spellclass-1-domains-show":1,"spellclass-2-show":1,"spellclass-2-spellpoints-show":1,"spellclass-2-spells-notes-show":1,"spellclass-2-perday-show":1,"spellclass-2-domains-show":1,"spelloptions-show":1,"spell-lists-show":1,"currency-show":1,"carried-weight-show":1,"loads-show":1,"worn-items-show":1,"other-items-show":1,"equipment-show":1,"npc-compimport-show":1,"npc-details-show":1,"npc-defense-show":1,"npc-offense-show":1,"npc-speed-show":1,"npc-repeating-weapons-show":1,"npc-spells-show":1,"npc-spell-like-abilities-show":1,"npc-tactics-show":1,"npc-statistics-show":1,"npc-feats-show":1,"npc-mythic-feats-show":1,"npc-skills-show":1,"npc-ecology-show":1,"npc-special-abilities-show":1,"custom-attr-sect-a-show":1,"custom-attr-sect-c-show":1,"custom-attr-sect-b-show":1,"custom-attr-sect-d-show":1,"custom-attr-sect-n-show":1,"header-image-show":1,"sheet-import-show":1,"roll-template-info-show":1,"macros-show":1,"migrations-show":1,"cleanup-show":1,"san-show":1,"buff-min-show":0,"buff-expand-show":0,"buff-column-show":0,"weapon-min-show":0,"weapon-expand-show":0,"weapon-column-show":0,"abilities-min-show":0,"abilities-expand-show":0,"abilities-column-show":0,"class-ability-min-show":0,"class-ability-expand-show":0,"class-ability-column-show":0,"feat-min-show":0,"feat-expand-show":0,"feat-column-show":0,"mythic-feats-min-show":0,"mythic-feats-expand-show":0,"mythic-feats-column-show":0,"racial-trait-min-show":0,"racial-trait-expand-show":0,"racial-trait-column-show":0,"traits-min-show":0,"traits-expand-show":0,"traits-column-show":0,"npc-spell-like-abilities-min-show":0,"npc-spell-like-abilities-expand-show":0,"npc-spell-like-abilities-column-show":0,"mythic-min-show":0,"mythic-expand-show":0,"mythic-column-show":0,"newspells-min-show":0,"newspells-expand-show":0,"newspells-column-show":0,"item-min-show":0,"item-expand-show":0,"item-column-show":0,"npcweapon-min-show":0,"npcweapon-expand-show":0,"npcweapon-column-show":0,"npcnewspells-min-show":0,"npcnewspells-expand-show":0,"npcnewspells-column-show":0,"npcfeat-min-show":0,"npcfeat-expand-show":0,"npcfeat-column-show":0,"npcmythic-feats-min-show":0,"npcmythic-feats-expand-show":0,"npcmythic-feats-column-show":0,"npc-abilities-min-show":0,"npc-abilities-expand-show":0,"npc-abilities-column-show":0,"npc-special-abilities-min-show":0,"npc-special-abilities-expand-show":0,"npc-special-abilities-column-show":0,extra_fields_san_show:1,extra_fields_attacks_show:1,skill_onetimecolumns_show:1,extra_fields_saves_show:1,extra_fields_spells_show:1,extra_fields_caster_show:1,extra_fields_abilities_show:1,extra_fields_init_show:1,extra_fields_speeds_show:1,extra_fields_defense_show:1,extra_fields_conditions_show:1}),Va.each(o.repeatingSections,(function(e){var t="repeating_"+e;getSectionIDs(t,(function(a){Ja(Va.reduce(a,(function(a,n){var r=t+"_"+n+"_";switch(e){case"weapon":a[r+"misc-show"]=1,a[r+"add-damage-show"]=1,a[r+"iterative-attacks-show"]=1,a[r+"advmacro-text-show"]=1;break;case"buff":case"buff2":a[r+"options-show"]=1,a[r+"description-show"]=1;break;case"spells":a[r+"misc-show"]=1,a[r+"attack-show"]=1,a[r+"description-show"]=1;break;case"class-ability":case"feat":case"racial-trait":case"trait":case"mythic-ability":case"mythic-feat":a[r+"description-show"]=1;break;case"item":a[r+"description-show"]=1,a[r+"armor-attributes-show"]=1,a[r+"weapon-attributes-show"]=1;break;case"npc-spell-like-abilities":a[r+"attack-show"]=1;break;case"ability":a[r+"options-show"]=1,a[r+"description-show"]=1,a[r+"misc-show"]=1,a[r+"showextrafields"]=1,a[r+"range-show"]=1,a[r+"attack-show"]=1}return a[r+"row-show"]=1,a[r+"ids-show"]=1,"buff"!==e&&"buff2"!==e&&(a[r+"macro-text-show"]=1),a}),{}),{silent:!0})}))})))}))})),on("change:repeating_weapon:source-item",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs([e.sourceAttribute],(function(t){var a=mn(e.sourceAttribute),n=t[e.sourceAttribute];n&&fs(n="repeating_item_"+n+"_create-attack-entry",null,!1,a)})))}))),on("change:repeating_weapon:source-ability",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs([e.sourceAttribute],(function(t){var a=mn(e.sourceAttribute),n=t[e.sourceAttribute];n&&kc(n,null,!1,null,a)})))}))),on("change:repeating_weapon:source-spell",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs([e.sourceAttribute],(function(t){var a=mn(e.sourceAttribute),n=t[e.sourceAttribute];n&&qs(n,null,!1,null,a)})))}))),on("change:delete_rep_spells change:delete_rep_weapon change:delete_rep_item change:delete_rep_ability change:delete_rep_mythic-feat change:delete_rep_mythic-ability change:delete_rep_buff change:delete_rep_buff2 change:delete_rep_trait change:delete_rep_racial-trait change:delete_rep_feat change:delete_rep_class-ability change:delete_rep_npc-spell-like-abilities",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs([e.sourceAttribute],(function(t){parseInt(t[e.sourceAttribute],10)&&function(e,t){var a=Va.once((function(){"function"==typeof e&&e()}));t?getSectionIDs(t,(function(e){var n="repeating_"+t+"_";e&&Va.size(e)?(e.forEach((function(e){removeRepeatingRow(n+e)})),a()):a()})):a()}((function(){var t;(t={})[e.sourceAttribute]=0,t[e.sourceAttribute+"_btn"]=0,Ja(t,{silent:!0}),/buff/i.test(e.sourceAttribute)&&lu()}),e.sourceAttribute.replace("delete_rep_",""))}))}))),on("change:hide_announcements",(function(){var e={};e[o.announcementVersionAttr]=1,setAttrs(e,o.silentParams)})),on("change:herolab_import",(function(e){n().debug("caught ".concat(e.sourceAttribute," event").concat(e.sourceType)),"player"===e.sourceType&&getAttrs(["herolab_import"],(function(e){var t;if(!Va.isUndefined(e.herolab_import))try{t=JSON.parse(e.herolab_import),Va.isArray(t.document.public.character)?Ju(t.document.public.character[0]):Ju(t.document.public.character),setAttrs({herolab_import:""},{silent:!0})}catch(e){console.log(e),setAttrs({herolab_import:e.message},{silent:!0})}}))}));var Qu=["npc-spellike-ability-text","npc-spells-known-text","character_name","cr_compendium","xp_compendium","alignment","size_compendium","type_compendium","init_compendium","senses_compendium","npc-aura","ac_compendium","npc_hp_compendium","fort_compendium","ref_compendium","will_compendium","dr_compendium","sr_compendium","npc-defensive-abilities","immunities","resistances","weaknesses","speed_compendium","space_compendium","reach_compendium","npc-melee-attacks-text","npc-ranged-attacks-text","npc-special-attacks","str_compendium","dex_compendium","con_compendium","int_compendium","wis_compendium","cha_compendium","bab_compendium","cmb_compendium","cmd_compendium","class_compendium","npc-feats-text","skills_compendium","racial_mods_compendium","environment","organization","other_items_treasure","languages","SQ_compendium","content_compendium","npc-spells-prepared_compendium"];function ep(e){var t=e.match(/^\s*([^\(]+)/),a="",n="",r="";return t&&t[1]&&(a=hn(a=t[1]),r=(r=(r=(n=(n=hn(n=a.replace(/\d+d\d+|\-\d+|\+|\d+|\//g,"")))[0].toUpperCase()+n.slice(1)).toLowerCase()).replace(/ray|cone|aura|mwk/gi,"")).replace(/\s+/g,"")),{name:a,basename:r,abilityName:n}}function tp(e,t,a,r,i){var s,c,o,l,u,p,d=0,f="",m=e,_=0,g="",b=0,h={enh:0,mwk:0,name:"",basename:"",atktype:"melee",type:"",range:"",countFullBAB:1,iter:[],dmgdice:0,dmgdie:0,dmgtype:"",crit:20,critmult:2,dmgbonus:0,plus:"",plusamount:"",plustype:"",note:""};try{if(n().debug("parseAttack: "+e),a&&(h.group="Full attack "+r),u=ep(e),h.name+=u.name,h.basename=u.basename,e=hn(e),(s=e.match(/^(\d+)\s*/))&&s[1]&&(h.countFullBAB=parseInt(s[1],10)||1,e=e.slice(s[0].length)),(s=e.match(/^([+\-]\d+|mwk)\s*/i))&&("mwk"===s[1].toLowerCase()?h.mwk=1:h.enh=parseInt(s[1],10)||0,h.type="weapon",e=e.slice(s[0].length)),Ks.cmbPlusStrsrch.test(h.basename)?(h.atktype="cmb",h.vs="cmd",h.type="natural",_=1):"melee"===t&&Ks.combatManeuversRegExp.test(h.basename)?(h.atktype="cmb",h.vs="cmd"):Ks.cmbMonsterSrch.test(h.basename)?(h.atktype="cmb",h.type="natural",h.vs="cmd"):/web/i.test(h.basename)?(h.atktype="ranged",h.type="special",h.vs="touch",h.range=10):/touch/i.test(h.basename)?(/range/i.test(h.basename)?h.atktype="ranged":h.atktype="melee",h.vs="touch"):/special/i.test(t)?(h.atktype="special",h.type="special"):h.atktype=t,h.type||(Ks.naturalAttackRegExp.test(h.basename)?h.type="natural":Ks.unarmedAttacksRegExp.test("")?h.type="unarmed":h.type="weapon"),h.vs||/touch|web/i.test(h.name)&&(h.vs="touch",/ranged|web/i.test(h.name)&&(h.atktype="ranged",/web/i.test(h.basename)&&(h.range=10))),e=hn(e),(s=e.match(/^[a-z\s]+/i))&&s[0]&&(s.index&&(b=s.index),e=e.slice(b+s[0].length)),n().debug("PFNPCParse atkstr is now "+e),e){if(c=(l=e.split(/\(|\)/))[0].split(/\//),/\d/.test(c[0])?h.iter=Va.map(c,(function(e,t){return/^[+\-]/.test(e)?parseInt(e,10)||0:-1*(parseInt(e,10)||0)})):"cmb"===h.atktype&&(h.iter[0]=0),l[1]){if(p=l[1].split(/,\s*/),o=Rn(g=hn(g=Va.reduce(p,(function(e,t){return/ft\./i.test(t)?h.range=t:/D[Cc]\s\d+/.test(t)?(s=t.match(/(D[Cc]\s\d+)/),h.DC=s[1].toUpperCase(),h.DCability=Ks.specialAttackDCAbilityBase[h.basename]||"CON",i&&"CON"===h.DCability&&(h.DCability="CHA"),h.DCEquation=On(h.DCability,"npc-hd-num",i),(s=t.match(/(Will|Fort|Ref|Fortitude|Reflex)\s*D[Cc]\s*\d+([^),.])/i))?(s[1]&&(g=s[1][0].toUpperCase()+s[1].slice(1).toLowerCase(),h.save=g),s[2]&&(h.save+=" "+s[2])):(s=t.match(/(Will|Fort|Ref|Fortitude|Reflex)/i))&&s[1]&&(g=s[1][0].toUpperCase()+s[1].slice(1).toLowerCase(),h.save=g)):/freq|day|constant|at.will/i.test(t)?h.frequency=t:/AC|hp/.test(t)||!/\d|plus/.test(t)?h.note+=t+", ":e+=t+" ",e}),"")),!0,!0),n().debug("##### Attack dice parse of "+g+" is ",o),o&&o.dice&&(h.dmgdice=o.dice,h.dmgdie=o.die,h.dmgbonus=o.plus,g=g.slice(o.spaces)),n().debug("PFParseAttack e3:"+g),g){var y=Nn(g,!0);n().debug("PFParseAttack e4:"+g+", crits:",y),h.crit=y.crit,h.critmult=y.critmult,g=g.slice(y.spaces)}(f=hn(g))&&(_&&(s=f.match(/\sac\s\d+/i))&&(h.note+=f.slice(s.index),f=hn(f.slice(0,s.index))),(s=f.match(/plus(.*)/i))&&(g=hn(s[1]),f=hn(f.slice(0,s.index)),/\d+d\d+/i.test(g)?(s=g.match(/(\d+d\d+)\s*([\w\s]*)/),h.plusamount=s[1],s[2]&&(h.plustype=s[2].replace(/^\s+|\s+$/g,""))):h.plus=g),f&&f.length>0&&(h.dmgtype+=f)),"cmb"===h.atktype||h.iter[0]||!h.dmgtype||!h.dmgdice||!h.dmgdie||h.plusamount||h.plustype||/bludg|slash|pierc/i.test(h.dmgtype)||(h.plustype=h.dmgtype,g=String(h.dmgdice)+"d"+String(h.dmgdie),h.dmgbonus&&(h.dmgbonus>0?g+="+"+h.dmgbonus:g+="-"+Math.abs(h.dmgbonus)),h.plusamount=g,h.dmgtype="",h.dmgdice=0,h.dmgdie=0)}for(d=2;d<l.length;)h.note+=hn(l[d]),d++}h.note&&(h.note=hn(h.note))}catch(t){n().error("parseAttack: error parsing:"+e,t),h.name&&(h.name+=" "),h.name+="Could not parse attack!",h.note=m+" , error: ",h.note+=t}finally{return n().debug("parse attack returning parse of "+e,h),h}}function ap(e,t,a){var r,i=[],s=!1;try{if(!e)return null;t||(t="melee"),e.slice(0,t.length).toLowerCase()===t&&(e=e.slice(t.length)),"*"!==e[0]&&":"!==e[0]||(e=e.slice(1)),(r=(e=En(e=Tn(e=Dn(e=hn(e))))).split(/\bor\b/i)).length>1&&(s=!0),i=Va.reduce(r,(function(e,r,i){var c,o;try{(c=yn(r)).length>1&&(s=!0),o=Va.reduce(c,(function(e,r){var c;try{(c=tp(r,t,s,i,a))&&e.push(c)}catch(e){n().error("parseAttacks",e)}finally{return e}}),[])}catch(e){n().error("parseAttacks",e)}finally{return e.concat(o)}}),[])}catch(e){n().error("parseAttacks",e)}return i}function np(e,t){var a,r,i,s,c,l,u="special",p="",d=!1,f={};try{a=t,r=ep(t),t.indexOf("(")>=0?Ks.spAttackAttacksPreProcess.test(r.basename)?(/rake/i.test(r.basename)?t=Ln(t,!0):/rend/i.test(r.basename)?t=Ln(t):/web/i.test(r.basename)&&(t="web "+(t=Ln(t,!0)),u="ranged"),d=!0):Ks.spAttackAttacks.test(r.basename)&&(d=!0):/damage|drain|dmg/i.test(r.basename)&&!/blood|energy/i.test(r.basename)&&Ks.abilitySrch.test(r.basename)&&(c=r.basename.match(/damage|drain/i),r.AbilityName="Ability "+c[0],t=r.AbilityName+" ("+t+")",d=!0),d&&((f=tp(t,u,!1,0)).specialtype="attack",f.group="Special",f.name=r.AbilityName&&"Ability"===r.AbilityName.slice(0,7)?r.AbilityName:r.name,f.basename=r.basename),d||(f.name=r.abilityName||r.name,f.basename=r.basename,f.specialtype="ability",f.rule_category="special-attacks",(l=/usable\severy/i.exec(a))&&(f.frequency="everyrounds",s=function(e){var t;return e=Tn(e),(t=o.diceDieregOneGroup.exec(e))?"[[ "+t[0]+" ]]":""}(i=a.slice(l.index+l[0].length)),s&&(f.used=s,(l=i.match(/rounds|days|minutes/i))&&(f.used+=" "+l[0]))),Ks.specialAttackDCAbilityBase[f.basename]&&(f.DCability=Ks.specialAttackDCAbilityBase[f.basename],1===parseInt(e.is_undead,10)&&"CON"===f.DCability&&(f.DCability="CHA")),f.shortdesc=function(e,t,a,r,i,s){var c,o="",l=e;try{(c=e.match(/D[Cc]\s*\d+/))&&(o=c[0].match(/\d+/),parseInt(o,10),o=On(t,a,r,i,s),l=(e.slice(0,c.index)||"")+o+(e.slice(c.index+c[0].length)||""))}catch(t){n().error("at replaceDCString, cannot find DC string in "+e,t)}finally{return l}}(Tn(a).replace(o.diceDieregOneGroup,"[[ $1 ]]"),f.DCability,"npc-hd-num",e.is_undead)),(p=zn(t))&&(f.ability_type=p)}catch(e){n().error("parseSpecialAttack",e)}finally{return f}}function rp(e,t,a,r,i){var s={};if(!e||!t||!a)return null;try{n().debug("getCasterObj spellObj,abilities,health are:",e,t,a),s.abilityMod=0,s.CL=0,s.concentrationBonus=0,i?(s.classname="Cleric",s.ability="WIS",s.abilityMod=t.wis.mod):r||!e.classname?(s.classname=r?"Spell-like abilities":"Sorcerer",s.ability="CHA",s.abilityMod=t.cha.mod):(s.classname=e.classname[0].toUpperCase()+e.classname.slice(1).toLowerCase(),Ks.casterDefaultAbility[e.classname]&&t[Ks.casterDefaultAbility[e.classname]]?(s.ability=Ks.casterDefaultAbility[e.classname].toUpperCase(),s.abilityMod=t[Ks.casterDefaultAbility[e.classname]].mod):(s.ability="CHA",s.abilityMod=t.cha.mod)),e.classLevel?s.CL=e.classLevel:s.CL=a.hdice1,e.concentration&&(s.concentrationBonus=e.concentration-s.abilityMod-s.CL),e.oppositionschools&&(s.oppositionschools=e.oppositionschools,e.oppositionschools=null),e.spellnotes&&(s.spellnotes=e.spellnotes,e.spellnotes=null),e.domains&&(s.domains=e.domains,e.domains=null)}catch(e){n().error("getCasterObj error trying to create obj returning null",e),s=null}finally{return s}}function ip(e,t,a,r,i,s,c,o){return o=o||{},e&&0!==Va.size(e)?o=Va.reduce(e,(function(e,o){var l,u="",p=!1,d=!1,f=0,m=0,_=0,g=0,b=1,h=0,y=0,v="",k="",w=NaN;try{if(u="repeating_weapon_"+generateRowID()+"_",y=Math.max(o.enh,o.mwk),k=o.basename,v+=o.name,o.plus&&(v+=" Plus "+o.plus),e[u+"name"]=v,e[u+"default_size"]=c.size,"ranged"===o.atktype?(_=t.ranged,e[u+"attack-type"]="attk-ranged",e[u+"attack-type-mod"]=t.ranged,e[u+"isranged"]=1):Ks.cmbPlusStrsrch.test(k)?(_=t.cmb,e[u+"attack-type"]="CMB",e[u+"attack-type-mod"]=t.cmb,p=!0,b=1.5,d=!0):"cmb"===o.atktype?(_=t.cmb,e[u+"attack-type"]="CMB",e[u+"attack-type-mod"]=t.cmb):"special"===o.atktype?(_=0,e[u+"attack-type-mod"]=0,e[u+"total-attack"]=0,"trample"===o.basename&&(p=!0,b=1.5,n().debug("CREATEATTACKS trample the attack is : ",o))):(p=!0,r.weaponfinesse?(_=t.melee2,e[u+"attack-type"]="attk-melee2",e[u+"attack-type-mod"]=t.melee2):(_=t.melee,e[u+"attack-type"]="attk-melee",e[u+"attack-type-mod"]=t.melee),"natural"===o.type&&("secondary"===o.naturaltype?b=.5:o.dmgMult&&1.5===o.dmgMult&&(e[u+"damage_ability_mult"]="1.5",b=1.5))),(p||d)&&(d&&0===o.dmgbonus?(e[u+"damage-ability"]="0",h=0):(e[u+"damage-ability"]="STR-mod",1!==b?(h=Math.floor(b*a.str.mod),e[u+"damage_ability_mult"]=b):h=a.str.mod),e[u+"damage-ability-mod"]=h),o.enh&&(e[u+"enhance"]=o.enh),o.mwk&&(e[u+"masterwork"]="1"),!d&&o.iter&&o.iter.length>0?w=parseInt(o.iter[0],10):d&&(w=_),isNaN(w)?"cmb"===o.atktype?/swallowwhole|pin/i.test(o.basename)?(e[u+"attack"]=5,e[u+"attack-mod"]=5,e[u+"total-attack"]=t.cmb+5):e[u+"total-attack"]=t.cmb:e[u+"total-attack"]=0:d?(e[u+"attack"]=0,e[u+"attack-mod"]=0,e[u+"total-attack"]=_):(e[u+"attack"]=w-y-_,e[u+"attack-mod"]=w-y-_,e[u+"total-attack"]=w),20!==o.crit&&(e[u+"crit-target"]=o.crit),2!==o.critmult&&o.critmult&&(e[u+"crit-multiplier"]=o.critmult),r.criticalfocus&&(e[u+"crit_conf_mod"]=4),e[u+"total-attack"]||(e[u+"total-attack"]=0),n().debug("Create attack e6 "+o.name+", enhance:"+o.enh+" dmg from attack:"+o.dmgbonus+", from str:"+h),e[u+"damage-dice-num"]=o.dmgdice,e[u+"default_damage-dice-num"]=o.dmgdice,e[u+"damage-die"]=o.dmgdie,e[u+"default_damage-die"]=o.dmgdie,e[u+"damage"]=o.dmgbonus-o.enh-h,e[u+"damage-mod"]=o.dmgbonus-o.enh-h,e[u+"total-damage"]=o.dmgbonus,o.note?e[u+"notes"]="("+o.type+") "+o.note:e[u+"notes"]="("+o.type+")",o.iter.length>1)for(f=1;f<o.iter.length;f++)e[u+"toggle_iterative_attack"+(m=f+1)]="@{var_iterative_attack"+m+"_macro}",e[u+"iterative_attack"+m+"_value"]=o.iter[f]-o.iter[0];else if(o.countFullBAB>1)for(f=1;f<o.countFullBAB;f++)e[u+"toggle_iterative_attack"+(m=f+1)]="@{var_iterative_attack"+m+"_macro}",e[u+"iterative_attack"+m+"_value"]=0;o.plusamount?(e[u+"precision_dmg_macro"]="[["+o.plusamount+"]]",o.plustype&&(e[u+"precision_dmg_type"]=o.plustype)):o.plus&&(e[u+"precision_dmg_type"]="Plus",e[u+"precision_dmg_macro"]=o.plus),o.dmgtype&&(e[u+"notes"]=e[u+"notes"]+", damage type:"+o.dmgtype),o.range?(g=parseInt(o.range,10),isNaN(g)&&(e[u+"notes"]=e[u+"notes"]+", range:"+o.range)):/tongue/i.test(o.name)?(l=3*i,e[u+"range"]=l,e[u+"vs"]="touch"):"melee"===o.atktype&&(s&&s.length>0&&(l=Va.filter(s,(function(e){return k.indexOf(e[0])>=0})))&&l[0]&&l[0][1]?e[u+"range"]=l[0][1]:i&&(e[u+"range"]=i)),o.vs&&!/tongue/i.test(o.name)&&(e[u+"vs"]=o.vs),o.group&&(e[u+"group"]=o.group),o.DC&&(n().debug("PFNPCParser has attack dc",o),e[u+"notes"]=e[u+"notes"]+" "+(o.save||"")+" "+o.DC+o.DCEquation?" "+o.DCEquation:"")}catch(e){n().error("createattacks error on:",o,e)}finally{return e}}),o):o}function sp(e,t,a,r,i,s,c,o,l){var u=[];try{if(l=l||{},c)try{(function(e){var t,a;try{if(a=Va.filter(e,(function(e){return"natural"===e.type})),Va.size(a)<=0)return e;1===Va.size(a)?(a[0].naturaltype="primary",(a[0].iter&&1===a[0].iter.length||isNaN(parseInt(a[0].iter,10)))&&(a[0].dmgMult=1.5)):(t=Va.groupBy(a,(function(e){return Ks.primaryNaturalAttacksRegExp.exec(e.name)})),1===Va.size(t)?Va.each(a,(function(e){e.naturaltype="primary"})):Va.each(a,(function(e){Ks.primaryNaturalAttacksRegExp.test(e.name)?e.naturaltype="primary":e.naturaltype="secondary"})))}catch(e){n().error("assignPrimarySecondary",e)}finally{return e}})(u=ap(c,"melee")),ip(u,i,e,a,s.reach,s.reachExceptions,t,l)}catch(e){n().error("parseAndCreateAttacks error creating melee attacks",e)}if(o)try{ip(u=ap(o,"ranged"),i,e,a,null,null,t,l)}catch(e){n().error("parseAndCreateAttacks error creating ranged attacks",e)}}catch(e){n().error("parseAndCreateAttacks",e)}finally{return l}}function cp(e,t){var a;return a=Va.map(e,(function(e){var a;try{(a=Va.findWhere(t,{name:e.name}))&&Va.each(Va.keys(a),(function(t){"description"===t?e.description=(e.description?e.description+", ":"")+(a.description||""):"shortdesc"===t?e.shortdesc=(e.shortdesc?e.shortdesc+", ":"")+(a.shortdesc||""):!e[t]&&a[t]&&(e[t]=a[t])}))}catch(e){n().error("combineSpecialAbilities err1",e)}finally{return e}})),t=Va.reject(t,(function(t){return!!Va.findWhere(e,{name:t.name})})),a=Va.union(a,t)}function op(e,t,a){var r=Va.once((function(){n().warn("Leaving importFromCompendium NOTHING DONE"),"function"==typeof a&&a()})),i=Qu.concat(["is_npc","alignment","npc_parse_no_recalc"]);getAttrs(i,(function(e){var a,i,s,c,l,u,p,d,f,m,_,g,b,h,y,v,k,w={},A={},C={},I={},x={},P={},S={},T={},E={},D={},M={},F=0,N=0,R=0,z=0,L=[],O=0,q=!1,H=!1,B={},U="",j="",W=0,G=null,X=0,V=-1,$={},K={},Y=[],Z=0;try{F=parseInt(e.fort_compendium,10)||0,N=parseInt(e.ref_compendium,10)||0,R=parseInt(e.will_compendium,10)||0,z=parseInt(e.bab_compendium,10)||0,w.level=0,parseInt(e.npc_parse_no_recalc,10)||(Z=1),w.is_npc="1",w.is_v1="1",w.PFSheet_Version=String(o.version.toFixed(3)),w["max-dex-source"]=3,rr(w),e.xp_compendium&&(w["npc-xp"]=e.xp_compendium),e.cr_compendium&&(a=hn(a=e.cr_compendium.replace(/\s*cr\s*/i,"")),w["npc-cr"]=a),e.type_compendium&&(w["npc-type"]=e.type_compendium),(q=/undead/i.test(e.type_compendium)||/undead/i.test(e.character_name))&&(w.is_undead="1"),e.character_name&&(w.race=e.character_name),e.class_compendium&&(w.add_class=1,W=0,l=e.class_compendium.split(","),Va.each(l,(function(t){var a,r=0,i="";try{(a=t.match(/\d+/))&&(r=parseInt(a[0],10)||0,i=hn(t.replace(/\s*\d+\s*/," "))),function(e,t,a){var r=0,i=0,s=0;try{if(r=(a=a||{}).level||0,e.CL&&e.classname){for(i=0;i<7&&(!(t["class-"+i+"-name"]||t["class-"+i+"-level"]>0)||(s=i,t["class-"+i+"-name"].toLowerCase()!==e.classname.toLowerCase()));i++);s>=6?n().warning("too many classes, cannot add "+e.classname):(a["class-"+s+"-name"]=e.classname||"",a["class-"+s+"-level"]=e.CL||0),e.CL&&(r+=e.CL||0),(a.level||0)!==r&&(a.level=r)}}catch(e){n().error("createClassEntries",e)}finally{return a}}({classname:i,CL:r},{},w),W++}catch(t){n().error("PFNPCparser error trying to parse class"+e.class_compendium)}})),W>1&&(w.multiclassed=1,w.class1_show=1),W=0,O=w.level),A=function(e){var t={};return t.str=Lo(e.str_compendium),t.dex=Lo(e.dex_compendium),t.con=Lo(e.con_compendium),t.wis=Lo(e.wis_compendium),t.int=Lo(e.int_compendium),t.cha=Lo(e.cha_compendium),t}(e),function(e,t){try{(t=t||{})["STR-base"]=e.str.base,t["DEX-base"]=e.dex.base,t["CON-base"]=e.con.base,t["WIS-base"]=e.wis.base,t["INT-base"]=e.int.base,t["CHA-base"]=e.cha.base,t.STR=e.str.base,t.DEX=e.dex.base,t.CON=e.con.base,t.WIS=e.wis.base,t.INT=e.int.base,t.CHA=e.cha.base,t["STR-mod"]=e.str.mod,t["DEX-mod"]=e.dex.mod,t["CON-mod"]=e.con.mod,t["WIS-mod"]=e.wis.mod,t["INT-mod"]=e.int.mod,t["CHA-mod"]=e.cha.mod}catch(e){n().error("createAbilityScoreEntries",e)}finally{return t}}(A,w),C=$c(e.size_compendium,w),"feats"===(k=e["npc-feats-text"]).slice(0,5).toLowerCase()&&(k=k.slice(5)),S=function(e){n().debug("buildImportantFeatObj is ",e);var t=Va.chain(e).filter((function(e){return!!e})).filter((function(e){return Ks.importantFeatRegExp.test(e)})).map((function(e){return e=hn(e),/\b[A-Z]$/i.test(e)&&(e=hn(e=e.slice(0,-2))),e})).reduce((function(e,t){var a,r="",i={},s={},c={},o=[],l="";try{if(t.indexOf("(")>=0&&(a=/(.*?)\((.*)\)/.exec(t),n().debug("looking at "+t+", split into ",a),t=a[1],r=a[2],t=hn(t),r=hn(r)),"improvedcritical"===(t=t.replace(/\s/g,"").toLowerCase())||"criticalmastery"===t)return e;e[t]=1,t.indexOf("critical")>0?(r=t,t="criticaldamage",(c=e.criticaldamage||{})[r]=1,e.criticaldamage=c):t.indexOf("skillfocus")>=0?(l=r.replace(" ","-"))&&(l=l[0].toUpperCase()+l.slice(1),(o=e.skillfocuses||[]).push(l),e.skillfocuses=o):"weaponfinesse"!==t&&"improvedcritical"!==t||((s=(i=e.attacks||{})[r]||{})[t]=1,i[r]=s,e.attacks=i)}catch(a){n().error("buildImportantFeatObj error:",a),e[t]=1}finally{return e}}),{}).value();return n().debug("returning important feats:",t),t}(L=yn(k)),X=function(e){var t,a;return e=hn(e=Dn(e)),/^Init/i.test(e)||/^[\+\-]{0,1}\d+/.test(e)?t=Fn(e,!0):null!==(a=e.match(/[\+\-]{0,1}\d+$/))?("+"!==(e=e.slice(a.index))[0]&&(e="-"+e),t=parseInt(e.match(/[\-\+]\d+$/),10)||0):t=Fn(e,!0),t}(e.init_compendium),function(e,t,a,r){var i=0;try{r=r||{},i=e-t.dex.mod,r.init=e,r["init-misc"]=i,r["init-misc-mod"]=i,r["init-ability-mod"]=t.dex.mod}catch(e){n().error("createInitEntries",e)}finally{return r}}(X,A,0,w),e.dr_compendium&&(w.DR=e.dr_compendium),e.sr_compendium&&(w.SR=e.sr_compendium,w["SR-macro-text"]=e.sr_compendium),function(e,t,a,r,i,s){var c,o,l,u="",p="";try{s=s||{},c=a.baseFort-e.con.mod,o=a.baseRef-e.dex.mod,l=a.baseWill-e.wis.mod,t||"-"===e.con.base?(c=a.baseFort-e.cha.mod,s["Fort-ability"]="CHA-mod",s["Fort-ability-mod"]=e.cha.mod):s["Fort-ability-mod"]=e.con.mod,i.greatfortitude&&(s["Fort-misc"]=2,s["Fort-misc-mod"]=2,c-=2),s["total-Fort"]=c,s["npc-Fort"]=c,s.Fort=a.baseFort,u="",(p=qn(r.fort_compendium))&&(u+="Fortitude "+p),i.lightningreflexes&&(s["Ref-misc"]=2,s["Ref-misc-mod"]=2,o-=2),s["total-Ref"]=o,s["npc-Ref"]=o,s.Ref=a.baseRef,0!==e.dex.mod&&(s["Ref-ability-mod"]=e.dex.mod),(p=qn(r.ref_compendium))&&(u+="Reflex "+p),i.ironwill&&(s["Will-misc"]=2,s["Will-misc-mod"]=2,l-=2),s["total-Will"]=l,s["npc-Will"]=l,s.Will=a.baseWill,0!==e.wis.mod&&(s["Will-ability-mod"]=e.wis.mod),(p=qn(r.will_compendium))&&(u+=p),u&&(s.saves_notes=u,s.toggle_save_notes="1")}catch(e){n().error("createSaveEntries",e)}finally{return s}}(A,q,{baseFort:F,baseRef:N,baseWill:R},e,S,w),function(e,t,a){try{a=a||{},t||"-"===e.con.base?(a["HP-ability"]="CHA-mod",a["HP-ability-mod"]=e.cha.mod):a["HP-ability-mod"]=e.con.mod}finally{return a}}(A,q,w),i=parseInt(w["HP-ability-mod"],10),O+=(x=function(e,t){var a,r={hp:0,hdie1:0,hdice1:0,basehp:0,misc:0,heal:""},i=0,s=0;try{t=t||0,/^hp/i.test(e)&&(e=e.slice(2)),e=(e=Dn(e=Tn(e))).replace("plus","+"),r.hp=parseInt(e,10)||0,0!==(a=Rn(e=e.slice(e.indexOf("(")+1),!0)).dice&&(r.hdice1=a.dice,r.hdie1=a.die,i=t*r.hdice1,r.misc=a.plus-i,r.basehp=Pn(r.hdice1,r.hdie1),(s=r.basehp+a.plus)!==r.hp&&(n().warn("parseNPChp, hp not adding right, should be:"+r.hp+" but getNPCHP returns "+s,r),r.misc+=r.hp-s),e=e.slice(a.spaces+1)),e&&(e=hn(e.replace(/[\);]/g,"")),r.heal=e||"")}catch(e){n().error("parseNPChp",e)}finally{return r}}(e.npc_hp_compendium,i)).hdice1||0,w.level=O,function(e,t,a,r){try{(r=r||{})["npc-hd-num"]=a.hdice1,r.level=a.hdice1,r["npc-hd"]=a.hdie1,r.HP=a.hp,r.HP_max=a.hp,r["non-lethal-damage_max"]=a.hp,r.auto_calc_hp="1",r.both_whisper_show="1",a.basehp&&(r["NPC-HP"]=a.basehp),a.misc&&(r["HP-formula-macro-text"]=a.misc,r["HP-formula-mod"]=a.misc),a.heal&&(r["npc-heal-conditions"]=a.heal)}catch(e){n().error("createHealthEntries",e)}finally{return r}}(0,0,x,w),P=function(e,t,a,r){var i,s=0,c="",o={ac:10,touch:10,ff:10,armor:0,shield:0,deflect:0,dex:0,dodge:0,natural:0,misc:0,note:"",size:0,altability:"",acbuff:0,uncanny:0,cmd:10,notes:"",cmdnotes:""};a=a||0,r=r||0;try{/^ac\s/i.test(e)&&(e=e.slice(3)),o.ac=parseInt(e,10)||0,(i=t.match(/(\d+)/))&&i[1]&&(o.cmd=parseInt(i[1],10)||0,(c=t.slice(i.index+i[0].length))&&(c=hn(c),o.cmdnotes=c)),(i=e.match(/Touch\s*?(\d+)/i))&&i[1]&&(o.touch=parseInt(i[1],10)),(i=e.match(/Flat\-footed\s*?(\d+)/i))&&i[1]&&(o.ff=parseInt(i[1],10)),(i=e.match(/([+\-]??\d+)\s*?Deflect[,\i\s]/i))&&i[1]&&(o.deflect=parseInt(i[1],10)),(i=e.match(/([+\-]??\d+)\s*?Nat[,u\s]/i))&&i[1]&&(o.natural=parseInt(i[1],10)),(i=e.match(/([+\-]??\d+)\s*?Dodge/i))&&i[1]&&(o.dodge=parseInt(i[1],10)),(i=e.match(/([+\-]??\d+)\s*?Size/i))&&i[1]&&(o.size=parseInt(i[1],10)),o.size!==r&&(o.size=r),(i=e.match(/([+\-]??\d+)\s*?armor/i))&&i[1]&&(o.armor=parseInt(i[1],10)),(i=e.match(/([+\-]??\d+)\s*?shield/i))&&i[1]&&(o.shield=parseInt(i[1],10)),(i=e.match(/\)\s*?(.*)/))&&i[1]&&(o.note=i[1]),(i=e.match(/([+\-]??\d+)\s*?Dex/i))&&i[1]?(o.dex=parseInt(i[1],10)||0,a!==o.dex&&(o.dex=a)):(i=e.match(/([+\-]??\d+)\s*?(Wis|Int|Str|Con|Cha)/i))&&i[1]&&i[2]&&(o.dex=parseInt(i[1],10)||0,o.altability=i[2].toUppercase()),s=o.dodge+o.dex+o.deflect+o.size+10,o.touch!==s&&(o.misc=o.touch-s),s=o.armor+o.shield+o.dodge+o.dex+o.natural+o.deflect+o.size+o.misc+10,o.ac!==s&&(o.acbuff=o.ac-s),o.ac===o.ff&&(o.dex>0||o.dodge>0)&&(o.uncanny=1)}catch(e){n().error("parseNPCAC",e)}finally{return o}}(e.ac_compendium,e.cmd_compendium,A.dex.mod,C.size),function(e,t,a,r,i,s,c){var o="DEX",l=t.dex.mod,u=0,p=0;try{if(c=c||{},e.altability&&"DEX"!==(o=e.altability.toUpperCase())){switch(c["AC-ability"]=o+"-mod",c["CMD-ability2"]=o+"-mod",e.altability.toLowerCase()){case"wis":l=t.wis.mod;break;case"int":l=t.int.mod;break;case"cha":l=t.cha.mod;break;case"con":l=t.con.mod;break;default:l=t.dex.mod}c["AC-ability-mod"]=l}e.uncanny&&(c["FF-ability"]=o+"-mod",c["FF-ability-mod"]=l,c["CMD-ability"]=o+"-mod",c["CMD-ability"]=l,c.uncanny_dodge=1,c.uncanny_cmd_dodge=1),p=i,a.defensivecombattraining&&(c.hd_not_bab=1,p=Math.max((r.hdice1||0)+(r.hdice2||0),s||0));try{u=10+p+t.str.mod+l+-1*e.size,isNaN(e.cmd)||u===e.cmd?c.CMD=u:(c.CMD=e.cmd,c["CMD-misc"]=e.cmd-u,c["CMD-misc-mod"]=e.cmd-u)}catch(e){n().error("createACEntries error trying to calculate CMD",e)}c.AC=e.ac,c.Touch=e.touch,c["Flat-Footed"]=e.ff,c["AC-deflect"]=e.deflect,c["AC-dodge"]=e.dodge,c["AC-misc"]=e.misc,c["AC-misc-mod"]=e.misc,c["AC-natural"]=e.natural,e.armor&&(c["armor3-equipped"]="1",c["armor3-acbonus"]=e.armor,c.armor3="Armor bonus",c["AC-armor"]=e.armor),e.shield&&(c["shield3-equipped"]="1",c["shield3-acbonus"]=e.shield,c.shield3="Shield bonus",c["AC-shield"]=e.shield),e.notes&&(c["defense-notes"]=e.notes),e.cmdnotes&&(c["cmd-notes"]=e.cmdnotes)}catch(e){}finally{return c}}(P,A,S,x,z,O,w),e.senses_compendium||(l=e.init_compendium.match(/senses/i))&&l[0]&&(e.senses_compendium=hn(e.init_compendium.slice(l.index+7))),e.senses_compendium&&(l=e.senses_compendium.match(/perception/i),w.vision=l?e.senses_compendium.slice(0,l.index-1):e.senses_compendium),e.speed_compendium&&(y=e.speed_compendium,v=y.split(/,\s*/),I=Va.reduce(v,(function(e,t,a){var r,i=0;try{0===a?(i=parseInt(t.match(/(\d+)/)[1],10)||0)&&(e.land=i):(r=t.match(/([\w]+)\s*(\d+)/))&&(i=parseInt(r[2],10)||0)&&(e[r[1].toLowerCase()]=i,/fly/i.test(r[1])&&(r=t.match(/\(([\w]+)\)/))&&r[1].length>0&&(e.flyability=r[1]))}catch(e){n().error("parseSped",e)}finally{return e}}),{}),function(e,t,a){var r="";try{a=a||{},Va.each(e,(function(e,t){switch(t){case"land":a["speed-base"]=e,a["speed-modified"]=e;break;case"fly":a["speed-fly"]=e;break;case"climb":a["speed-climb"]=e;break;case"swim":a["speed-swim"]=e;break;case"flyability":a["speed-fly-maneuverability"]=e;break;default:a["speed-misc"]=e,r.length>0&&(r+=", "),r+=t+" "+e}})),r&&(a["speed-notes"]=r),t.run&&(a["run-mult"]=5)}catch(t){n().error("parseAndSetSpeed error, speedMap",e,t)}finally{return a}}(I,S,w)),e.alignment&&(w.alignment=e.alignment.toUpperCase()),e.space_compendium&&(w.space=function(e){var t,a,n=e;try{(t=e.match(/\s*(\d*\.?\d*)?/))&&(a=parseFloat(t[1]),isNaN||(n=String(a)))}finally{return n}}(e.space_compendium)),T=function(e){var t,a="",r=[],i=[],s={reach:5,reachNotes:"",reachExceptions:[]};if(!e)return s;try{(t=e.match(/reach/i))&&(e=e.slice(t.index+t[0].length)),"2-1/2"===(e=(e=(e=Dn(e=hn(e))).replace("21/2","2-1/2")).replace("2.5","2-1/2")).slice(0,5)?(s.reach=2.5,a=e.slice(5)):(s.reach=parseInt(e,10)||0,a=qn(e)),a&&a.indexOf("(")>=0&&(s.reachNotes=a,(a=hn(a.replace("(","").replace(")","").replace(/with\s/gi,"").replace(";","").replace(/ft[\.\s]*/gi,"").replace(/,\s*/g,",")))&&(r=a.split(","),(i=Va.reduce(r,(function(t,a){var r=[];try{"2-1/2"===a.slice(0,5)?(r.push(hn(a.slice(5))),r[0]&&(r.push(2.5),t.push(r))):(r.push(qn(e)||""),r[0]&&(r.push(parseInt(e,10)||0),t.push(r)))}catch(e){n().error("parseReach inner error erri:",e)}finally{return t}}),[]))&&i.length>0&&(s.reachExceptions=i)))}catch(e){n().error("parseReach error:",e)}finally{return s}}(e.reach_compendium),T?(w.reach=T.reach,T.reachNotes&&(w["reach-notes"]=T.reachNotes)):((T={}).reach=5,T.reachExceptions=[]),M=function(e,t,a,r,i,s,c){var o,l,u="",p=0,d={},f=0,m=0;try{c=c||{},d.melee=e.str.mod+r+t.size,c.bab=r,c["npc-bab"]=r,c["melee-ability-mod"]=e.str.mod,c["attk-melee"]=d.melee,c["melee-ability"]="STR-mod",c["melee-ability-mod"]=e.str.mod,c.melee_bab="bab",c["melee_bab-mod"]=r,d.melee2=e.dex.mod+r+t.size,c["melee2-ability"]="DEX-mod",c["melee2-ability-mod"]=e.dex.mod,c["attk-melee2"]=d.melee2,c.attk_melee2_note="Weapon Finesse",c.melee2_bab="bab",c["melee2_bab-mod"]=r,d.ranged=e.dex.mod+r+t.size,d.ranged2=d.ranged,c["ranged-ability"]="DEX-mod",c["ranged-ability-mod"]=e.dex.mod,c["attk-ranged"]=d.ranged,c.ranged_bab="bab",c["ranged_bab-mod"]=r,c["ranged2-ability"]="DEX-mod",c["ranged2-ability-mod"]=e.dex.mod,c["attk-ranged2"]=d.ranged,c.ranged2_bab="bab",c["ranged2_bab-mod"]=r,a.defensivecombattraining?(c.cmb_bab="level",c["cmb_bab-mod"]=i,c.cmb2_bab="level",c["cmb2_bab-mod"]=i,p=i):(c.cmb_bab="bab",c["cmb_bab-mod"]=r,c.cmb2_bab="bab",c["cmb2_bab-mod"]=r,p=r),a.agilemaneuvers?(c["CMB-ability"]="DEX-mod",c["CMB-ability-mod"]=e.dex.mod,c["CMB2-ability"]="DEX-mod",c["CMB2-ability-mod"]=e.dex.mod,m=e.dex.mod+p-t.size,c.cmb_desc="Agile Maneuvers"):(c["CMB-ability"]="STR-mod",c["CMB-ability-mod"]=e.str.mod,c["CMB2-ability"]="STR-mod",c["CMB2-ability-mod"]=e.str.mod,m=e.str.mod+p-t.size),l=m,s&&(o=s.match(/\d+/))&&(l=parseInt(o[0],10),(u=s.slice(o.index+o[0].length))&&(d.cmbnotes=u,c["CMB-notes"]=u)),c.CMB=l,d.cmb=l,c.CMB2=l,d.cmb2=l,(f=l-m)&&(c["attk-CMB-misc"]=f,c["attk-CMB-misc-mod"]=f,c["attk-CMB2-misc"]=f,c["attk-CMB2-misc-mod"]=f),a.criticalfocus&&(c.cmb_crit_conf=4,c.ranged_crit_conf=4,c.melee_crit_conf=4,c.cmb2_crit_conf=4,c.ranged2_crit_conf=4,c.melee2_crit_conf=4)}catch(e){n().error("parseAndCreateAttackGrid error creating CMB attack types",e)}finally{return d}}(A,C,S,z,O,e.cmb_compendium,w),Va.extend(K,w),Ja(w,o.silentParams,(function(){n().notice("saved 1")})),function(e,t,a,n){Va.reduce(e,(function(e,n){var r=generateRowID(),i="repeating_ability_"+r+"_";return e[i+"name"]=n,e[i+"rule_category"]="feats",e[i+"showinmenu"]="1",e[i+"CL-basis"]="@{npc-hd-num}",e[i+"CL-basis-mod"]=a||0,t&&(e[i+"class-name"]=t),e[i+"row_id"]=r,e[i+"frequency"]="not-applicable",e[i+"ability_type"]="",e}),n)}(L,K.race,K.level,w={}),Va.size(w)&&(Va.extend(K,w),Ja(w,o.silentParams,(function(){n().notice("saved 2")})),w={}),sp(A,C,S,0,M,T,e["npc-melee-attacks-text"],e["npc-ranged-attacks-text"],w),Va.size(w)&&(Va.extend(K,w),Ja(w,o.silentParams,(function(){n().notice("saved 3")})),w={}),e["npc-spells-prepared_compendium"]?(j=e["npc-spells-prepared_compendium"],H=!0):e["npc-spells-known-text"]&&(j=e["npc-spells-known-text"]),j&&(V=0,w.use_spells=1,h={},s=(g=j)?(h.classLevel=-1,h.concentration=-1,h.classname="",h.spellsByLevel=[],h.spellnotes="",b=g.split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/),h=Va.reduce(b,(function(e,t){var a,r,i,s,c,o,l,u=[],p={};try{/C[Ll]\s*\d+/i.test(t)?-1===e.classLevel&&((a=t.match(/C[Ll]\s*(\d+)/i))&&a[1]&&(e.classLevel=parseInt(a[1],10)||0),(a=t.match(/concentrat[\w]*\s*[+\-]??(\d+)/i))&&a[1]&&(e.concentration=parseInt(a[1],10)||0),(a=t.match(/([\w\s]*)spells\s(?:known|prepared)/i))&&a[1]?(e.classname=a[1].replace(/^\s|\s$/g,""),e.classname=e.classname.toLowerCase()):/spells\sprepared/i.test(t)?e.classname="cleric":e.classname="sorcerer"):/opposition schools|domains/i.test(t)?(l=t.match(/opposition schools/i))?(o=t.slice(l.index+l[0].length),e.oppositionschools=hn(o)):(a=t.match(/domains/i),u=(i=(t=t.slice(a.index+a[0].length)).split(",")).map((function(e){return hn(e)})),e.domains=u):/\u2013|\u2014|-/.test(t)?(p.perDay=-1,p.spellLevel=-1,(i=t.split(/\u2013|\u2014|-/))&&i[0]&&(a=i[0].match(/^(\d+)/))&&a[1]&&(p.spellLevel=parseInt(a[1],10)||0,(a=i[0].match(/(\d+)\/day/i))&&a[1]&&(p.perDay=parseInt(a[1],10)||0)),i&&i[1]&&(s=i[1].split(","),r=Va.reduce(s,(function(r,i){var s={};try{a=i.split(/\(dc/i),s.name=a[0].replace(/^\s|\s$/g,""),a[1]&&(c=a[1],(a=c.match(/\d+/))&&a[0]&&(s.DC=parseInt(a[0],10)||0)),"D"===s.name.slice(-1)&&(s.name=hn(s.name.slice(0,-1)),s.isDomain=1,e.classname&&"cleric"===e.classname||(e.classname="cleric")),r.push(s)}catch(e){n().error("PFNPCParser.parseSpells errinner on spell: "+i+" on line"+t,e)}finally{return r}}),[])),p.spellLevel>=0&&r&&r.length>0&&(p.spells=r,e.spellsByLevel.push(p))):e.spellnotes+=t}catch(e){n().error("PFNPCParser.parseSpells error on line "+t,e)}finally{return e}}),h),h):null,s&&(w.use_spells=1,function(e,t,a,r){var i=!1,s=0;try{r=r||{},(t=t||0)<0&&(t=0),a&&(a["spellclass-"+t+"-name"]||a["spellclass-"+t+"-level"])&&(parseInt(a["spellclass-"+t+"-level"],10)!==parseInt(e.CL,10)||vn(a["Concentration-"+t+"-ability"])!==e.ability.toUpperCase()?t++:i=!0),t>2?(n().error("Could not setCasterFields, 0,1,2 spellclasses already defined:"),e.pageClassIdx=-1):i?(r["spellclass-"+t+"-name"]=r["spellclass-"+t+"-name"]+" and "+e.classname,e.pageClassIdx=t):(r["spellclass-"+t+"-name"]=e.classname,r["spellclass-"+t+"-level"]=e.CL,r["spellclass-"+t+"-level-total"]=e.CL,/wizard|cleric|druid|paladin|ranger|investigator|shaman|witch|alchemist|warpriest/i.test(e.classname)?r["spellclass-"+t+"-casting_type"]=2:r["spellclass-"+t+"-casting_type"]=1,e.ability&&(r["Concentration-"+t+"-ability"]=e.ability+"-mod"),r["Concentration-"+t+"-mod"]=e.abilityMod,e.concentrationBonus&&(r["Concentration-"+t+"-misc"]=e.concentrationBonus),e.pageClassIdx=t,e.oppositionschools&&(r["spellclass-"+t+"-oppositionschool-0"]=e.oppositionschools),e.spellnotes&&(r["spellclass-"+t+"-notes"]=e.spellnotes),e.domains&&(r["spellclass-"+t+"-domains-show"]=1,s=0,Va.each(e.domains,(function(e){r["spellclass-"+t+"-domain-"+s]=e,r["spellclass-"+t+"-domaintype-"+s]="Domain",++s>1&&(r["domain0"+s+"_show"]=1)}))))}catch(e){n().error("setCasterFields",e)}finally{return r}}(c=rp(s,A,x,!1,H),V,K,w),function(e,t,a){a=a||{},e&&t&&Va.each(e.spellsByLevel,(function(e){var r=parseInt(e.spellLevel,10)||0,i=0,s="";try{s="spellclass-"+t.pageClassIdx+"-level-"+r,e.perDay&&(a[s+"-class"]=e.perDay,a[s+"-spells-per-day_max"]=e.perDay,a[s+"-spells-per-day"]=e.perDay),i=10+r+(parseInt(t.abilityMod,10)||0)}catch(e){n().error("createSpellEntries error setting spells per day",e)}a=Va.reduce(e.spells,(function(e,s){var c=0,o="repeating_spells_"+generateRowID()+"_";try{a[o+"name"]=s.name[0].toUpperCase()+s.name.slice(1),a[o+"classnumber"]=t.pageClassIdx,a[o+"spell_class_r"]=t.pageClassIdx,a[o+"spellclass"]=t.classname,a[o+"spell_level"]=r,a[o+"spell_level_r"]=r,s.DC&&((c=parseInt(s.DC,10)||0)!==i&&(a[o+"DC_misc"]=c-i),a[o+"savedc"]=c),t.concentration&&(a[o+"Concentration-mod"]=t.concentration),s.isDomain&&(a[o+"isDomain"]=1)}catch(e){n().error("createSpellEntries error setting spell :",s,e)}finally{return a}}),a)}))}(s,c,w),Va.size(w)&&(Va.extend(K,w),Ja(w,o.silentParams,(function(){n().notice("saved 4")})),w={}))),e["npc-spellike-ability-text"]&&(d=function(e){var t,a="",r={};try{r.spellLikeAbilities=[],r.CL=0,r.concentration=0,r.classname="",t=e.split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/),Va.each(t,(function(e){var t,i,s,c,o="",l="",u={},p=0,d="",f="",m=0,_=0,g=0,b=0;try{if(/CL\s*\d+/i.test(e)||/concentrat/i.test(e)||/psychic\smagic/i.test(e)||/spell.like.abilit/i.test(e)?_=1:/\u2013|\u2014|-/.test(e)&&(g=1),_)/CL\s*\d+/i.test(e)&&(t=e.match(/CL\s*(\d+)/i))[1]&&(r.CL=parseInt(t[1],10)||0),/concentrat/i.test(e)&&(t=e.match(/concentrat[\w]*\s*[+\-]??(\d+)/i))[1]&&(r.concentration=parseInt(t[1],10)||0),/psychic\smagic/i.test(e)?r.classname="Psychic Magic":r.classname="Spell-like abilities";else{if(!g)return void n().warn("Cannot parse "+e);t=e.match(/\u2013|\u2014|\-/),l=e.slice(t.index+1),o=hn(e.slice(0,t.index)).toLowerCase(),(t=o.match(/constant|will|day|month/i))&&t[0]?(f=t[0].toLowerCase(),u.type=f,"day"!==f&&"month"!==f||(b=1,(t=o.match(/\d+/))&&t[0]&&(m=parseInt(t[0],10)||0,u.perDay=m))):(c=o.split("/")).length>=2&&(b=1,(t=c[0].match(/\d+/))&&t[0]&&(m=parseInt(t[0],10)||0,u.perDay=m),f="other",u.type=f,u.otherPer=c[1]),s=yn(l),(i=Va.reduce(s,(function(e,r){var i={};try{i.type=f,b&&m>0&&(i.perDay=m),(t=r.match(/level\s*(\d+)/i))&&(t[1]&&(i.spell_level=parseInt(t[1],10)||0),r=r.replace(t[0],"")),(t=r.match(/D[Cc]\s*\d+/))&&(d=r.replace(t[0],""),a=t[0].match(/\d+/),p=parseInt(a,10)||0,i.DC=p,(t=d.match(/\b(fortitude|willpower|reflex|fort|will|ref)\b([^,]+,)/i))&&(i.save=t[0])),r.indexOf("(")>0?(i.name=r.slice(0,r.indexOf("(")-1),a=r.slice(r.indexOf("(")-1),i.shortdesc=a):i.name=r,i.spell_level&&/^summon/i.test(i.name)&&(i.name+=" Level "+String(i.spell_level)),e.push(i)}catch(t){n().error("parseSLAs, error reducing to SLAArray for: "+r,t),i.name?i.description=r:i.name=r,e.push(i)}finally{return e}}),[]))&&Va.size(i)>0&&(u.type=f,b&&m>0&&(u.perDay=m),u.SLAs=i,r.spellLikeAbilities.push(u))}}catch(t){n().error("parseSLAs error parsing"+e,t)}}))}catch(e){n().error("parseSLAs",e)}finally{return r.spellLikeAbilities&&Va.size(r.spellLikeAbilities)>0?r:null}}(e["npc-spellike-ability-text"]),d&&(c=rp(d,A,x,!0),w=function(e,t,a,r,i){var s="ability";return i=i||{},e&&t?(r=r||0,Va.each(e.spellLikeAbilities,(function(c){var o=parseInt(c.perDay,10)||0,l=c.type;i=Va.reduce(c.SLAs,(function(i,c){var u,p="repeating_"+s+"_"+u+"_",d="",f=0,m=0;try{switch(u=generateRowID(),i[(p="repeating_"+s+"_"+u+"_")+"name"]=c.name[0].toUpperCase()+c.name.slice(1),i[p+"ability_type"]="Sp",i[p+"rule_category"]="spell-like-abilities",i[p+"showinmenu"]="1",t.ability?(t.ability,i[p+"ability-basis"]="@{"+t.ability+"-mod}"):i[p+"ability-basis"]="@{CHA-mod}",i[p+"CL-basis"]="@{npc-hd-num}",i[p+"CL-basis-mod"]=r,a&&(i[p+"class-name"]=a),t.CL?((f=r||0)>0&&(i[p+"CL-misc"]=t.CL-f,i[p+"CL-misc-mod"]=t.CL-f),m=t.CL):m=r,i[p+"casterlevel"]=m,c.spell_level?c.spell_level===r?i[p+"spell_level-basis"]="@{casterlevel}":c.spell_level===Math.floor(r/2)?i[p+"spell_level-basis"]="floor(@{casterlevel}/2)":(i[p+"spell_level-basis"]="0",i[p+"spell_level-misc"]=c.spell_level):i[p+"spell_level-basis"]="floor(@{casterlevel}/2)",l){case"day":i[p+"frequency"]="perday",i[p+"used"]=o,i[p+"used_max"]=o,i[p+"max-calculation"]=o,i[p+"hasfrequency"]="1",i[p+"hasuses"]="1";break;case"will":i[p+"frequency"]="atwill",i[p+"hasfrequency"]="1";break;case"constant":i[p+"frequency"]="constant",i[p+"hasfrequency"]="1";break;case"month":i[p+"frequency"]="permonth",i[p+"used"]=o,i[p+"used_max"]=o,i[p+"max-calculation"]=o,i[p+"hasfrequency"]="1",i[p+"hasuses"]="1";break;case"everyrounds":i[p+"frequency"]="everyrounds",i[p+"hasfrequency"]="1",i[p+"rounds_between"]=c.used||"";break;case"other":i[p+"frequency"]="other",i[p+"used"]=o,i[p+"used_max"]=o,i[p+"max-calculation"]=o,i[p+"hasfrequency"]="1",i[p+"hasuses"]="1",e.otherPer&&(d="Frequency per :"+e.otherPer);break;default:i[p+"frequency"]="not-applicable",i[p+"used"]=0,i[p+"used_max"]=0,i[p+"max-calculation"]="",i[p+"hasfrequency"]="",i[p+"hasuses"]=""}if(c.save&&(i[p+"save"]=c.save),c.DC)try{c.save||(i[p+"save"]="See Text"),t.abilityMod&&(f=0,(f=c.spell_level?10+t.abilityMod+c.spell_level:10+t.abilityMod+Math.floor(m/2))!==c.DC&&(i[p+"spell_level-misc"]=c.DC-f,i[p+"spell_level-misc-mod"]=c.DC-f))}catch(e){n().error("createSLAentries, error trying to calculate DC: "+c,e)}c.description&&(i[p+"description"]=c.description),c.shortdesc&&(d=d?c.shortdesc+", "+d:c.shortdesc),d&&(i[p+"short-description"]=d)}catch(e){n().error("createSLAEntries error setting SLA :",c,e)}finally{return i}}),i)})),i):i}(d,c,K.race,K.level,w),Va.size(w)&&(Va.extend(K,w),Ja(w,o.silentParams,(function(){n().notice("saved 5")})),w={}))),p=function(e,t){var a;return t?(a=yn(t),Va.reduce(a,(function(t,a){var r;try{r=np(e,a)}catch(e){n().error("parseSpecialAttacks",e),(r={}).name=a,r.specialtype="ability",r.rule_category="special-attacks"}finally{return t.push(r),t}}),[])):{}}(w,e["npc-special-attacks"],M.cmb),p&&p.length>0&&(ip((f=Va.groupBy(p,"specialtype")).attack,M,A,S,null,null,C,w),$=f.ability,Va.size(w)&&(Va.extend(K,w),Ja(w,o.silentParams,(function(){n().notice("saved 6")})),w={})),e.content_compendium&&(B=function(e){var t,a={description:[],specialAbilities:[]};return t=hn(t=(e=e.replace(/\((Ex|Sp|Su)\)\s*(?:\r\n|[\n\v\f\r\x85\u2028\u2029])/gi,"($1) ")).split(/\s\s\s|\r\n|[\n\v\f\r\x85\u2028\u2029]|special abilities|\.(?=[^\.]+\((?:Ex|Sp|Su)\))/i)).filter((function(e){return e&&!/^special abilities$/i.test(e)})),a=Va.reduce(t,(function(e,t){var a,r={},i="";try{(a=t.match(/\((Su|Ex|Sp)\)|^(\w+):/i))?a[2]?(r.name=a[2],r.description=hn(t.slice(a[0].length+1)),e.specialAbilities.push(r)):(i=t.slice(0,a.index),r.name=i.replace(/^[^\w]+|[^\w]$/,""),r.basename=r.name.replace(/\s/g,"").toLowerCase(),r.rule_category="special-abilities",r.ability_type=a[1][0].toUpperCase()+a[1][1].toLowerCase(),r.description=hn(t.slice(a.index+a[0].length+1)),(a=r.description.match(/(\d+d\d+) (?:points of){0,1}(.*?) damage/i))?(a[1]&&(r.extraDamage="[["+a[1]+"]]"),a[2]&&(r.extraDamageType=a[2])):(a=r.description.match(/([a-z]) for (\d+d\d+) (rounds|minutes|hours|days)/i))&&(a[2]&&(r.extraDamage="[["+a[2]+"]] "+a[3]||0),a[1]&&(r.extraDamageType=a[1])),(a=r.description.match(/dc is (cha|con|wis|int|str|dex)[a-zA-Z]*.based/i))&&a[1]?(i=a[1].toUpperCase(),r.DCability=i):Ks.specialAttackDCAbilityBase[r.basename]&&(r.DCability=Ks.specialAttackDCAbilityBase[r.basename]),(a=r.description.match(/DC (\d+) (Will|Fort|Ref)[a-zA-Z]* save/i))?(a[1]&&(r.DC=a[1]),a[2]&&(i=a[2][0].toUpperCase()+a[2].slice(1).toLowerCase(),r.save=i)):(a=r.description.match(/(Will|Fort|Ref)[a-zA-Z]* DC (\d+) ([^),.])/i))&&(a[1]&&(i=a[1][0].toUpperCase()+a[1].slice(1).toLowerCase(),r.save=i,a[3]&&(r.save+=" "+a[3])),a[2]&&(r.DC=a[2])),e.specialAbilities.push(r)):e.description.push(t+"\r\n")}catch(e){n().error("parseSpecialAbilities error parsing: "+t+" error is"+e)}finally{return e}}),a),a}(e.content_compendium),B?(B.description&&Va.size(B.description)>0&&(U=Va.reduce(B.description,(function(e,t){return e+=" ",e+=t}),""),w.character_description=U),B.specialAbilities&&($=cp($,B.specialAbilities))):w.character_description=e.content_compendium),e.SQ_compendium&&(Y=function(e){var t,a,n=[];return e?((t=e.match(/^SQ[\s:]*/i))&&(e=e.slice(t[0].length)),a=yn(e),Va.each(a,(function(e){var t,a={};a.name=e,(t=zn(e))&&(a.ability_type=t),a.rule_category="special-qualities",n.push(a)})),n):null}(e.SQ_compendium),Y&&($=cp($,Y))),$&&Va.size($)>0&&(!function(e,t,a,r,i){var s={},c="",o=0,l=0,u=0,p=0;try{p=Math.floor(r/2),c=a,s=Va.chain(e).map((function(e){var t;try{e.description=e.description||"",e.note&&(e.description&&(e.description+=", "),e.description+=e.note.replace(/,\s$/,"")),e.other&&(e.description&&(e.description+=", "),e.description+=e.other.replace(/,\s$/,""),e.other=null),e.ability_type||e.name&&(t=zn(e.name))&&(e.ability_type=t,e.name=e.name.replace(/\b(Su|Ex|Sp)\b/i,"").replace("()",""))}catch(e){n().error("createFeatureEntries err3",e)}finally{return e}})).filter((function(e){return!!e.name})).reduce((function(e,a){var r,s;try{e[(s="repeating_ability_"+(r=generateRowID())+"_")+"name"]=a.name,e[s+"row_id"]=r,e[s+"showinmenu"]="1",a.shortdesc&&(e[s+"short-description"]=a.shortdesc),a.description&&(e[s+"description"]=a.description),a.used?a.frequency&&"everyrounds"===a.frequency?(e[s+"frequency"]=a.frequency,e[s+"rounds_between"]=a.used,e[s+"hasfrequency"]="1",e[s+"used"]=0,e[s+"used_max"]=0,e[s+"max-calculation"]=""):(a.frequency?(e[s+"frequency"]=a.frequency,e[s+"hasfrequency"]=a.frequency):(e[s+"frequency"]="perday",e[s+"hasfrequency"]="perday"),e[s+"hasuses"]="1",e[s+"used"]=a.used,e[s+"used_max"]=a.used,e[s+"max-calculation"]=a.used):(e[s+"frequency"]="not-applicable",e[s+"used"]=0,e[s+"used_max"]=0,e[s+"max-calculation"]="",e[s+"hasfrequency"]="",e[s+"hasuses"]=""),a.dmgtype&&(e[s+"damage-type"]=a.dmgtype),a.rule_category&&(e[s+"rule_category"]=a.rule_category),a.ability_type?e[s+"ability_type"]=a.ability_type:e[s+"ability_type"]="",e[s+"CL-basis"]="@{npc-hd-num}",e[s+"CL-basis-mod"]=i.level||0,c&&(e[s+"class-name"]=c),a.save&&(e[s+"save"]=a.save),a.DCability?(e[s+"ability-basis"]="@{"+a.DCability.toUpperCase()+"-mod}",u=t[a.DCability.toLowerCase()].mod):"Sp"===a.ability_type||i.is_undead?(e[s+"ability-basis"]="@{CHA-mod}",u=t.cha.mod):(e[s+"ability-basis"]="@{CON-mod}",u=t.con.mod),a.extraDamage&&(e[s+"damage-macro-text"]=a.extraDamage),a.extraDamageType&&(e[s+"damage-type"]=a.extraDamageType),e[s+"spell_level-basis"]="floor(@{casterlevel}/2)",a.DC&&(l=parseInt(a.DC,10)||0,0!=(o=l-(u+p+10))&&(e[s+"spell_level-misc"]=o,e[s+"spell_level-misc-mod"]=o))}catch(e){n().error("createFeatureEntries",e)}finally{return e}}),{}).value(),i=Va.extend(i,s)}catch(e){n().error("createFeatureEntries",e)}finally{return i}}($,A,K.race,K.level,w),(G=Va.find($,(function(e){return/sneak.attack/i.test(e.name)})))&&(w.global_precision_dmg_macro="[[[[floor((@{level}+1)/2)]]d6]]",w.global_precision_dmg_type=G.name),Va.size(w)&&(Va.extend(K,w),Ja(w,o.silentParams,(function(){n().notice("saved 7")})),w={})),e.skills_compendium&&(m=e.skills_compendium,_=m.match(/[\w][\w\s]+\s*(?:\([\w\s,]+\))?\s*[+\-]\d+[,]??/g),D=Va.reduce(_,(function(e,t){var a,n=t.match(/^([\w][\w\s]+[\w])\s*(\([\w\s,]+\))??([+\s]+\d+)$/),r="",i=0;return n&&(i=parseInt(n[3],10)||0,r=(r=(r=n[1].replace(/^\s+|\s+$/g,""))[0].toUpperCase()+r.slice(1)).replace(/\s/g,"-"),n[2]?(a=n[2].split(/,\s*/),Va.each(a,(function(t){t=(t=t.replace(/^\s+|,|\(|\)|\s+$/g,""))[0].toUpperCase()+t.slice(1),e[r+(t="Knowledge"===r?"-"+t:"["+t+"]")]=i}))):e[r]=i),e}),{})||{},u=function(e){var t,a,r=e.toLowerCase().replace(/\s/g,"");try{(a=Va.find(Ks.creatureTypeClassSkills,(function(e,t){return new RegExp(t).test(r)})))&&a.length>0&&(t=a),(a=Va.find(Ks.creatureSubtypeClassSkills,(function(e,t){return new RegExp(t).test(r)})))&&(t=t?t.concat(a):a)}catch(e){n().error("parseCreatureClassSkills",e)}finally{return t||[]}}(e.type_compendium),e.racial_mods_compendium&&(E=function(e){var t,a,r=Va.map(Do,(function(e){return e.toLowerCase()})),i=Va.map(ni,(function(e){return e.toLowerCase()})),s=Va.map(Xr,(function(e){return e.toLowerCase()})),c=ti,o="",l="",u="",p=!1,d="",f={},m=[],_={},g={skillmods:f,skillnotes:m,abilitymods:_};if(!e)return g;if((t=e.split(";")).length>1&&(e=t[0],o=t[1]),o){try{l=o.toLowerCase(),(u=Va.find(r,(function(e){return l.indexOf(e)>=0})))&&(d=Va.find(i,(function(e){return l.indexOf(e)>=0})))&&(_[d[0].toUpperCase()+d.slice(1)]=u.toLowerCase(),p=!0)}catch(e){n().error("parseSkillRacialBonuses inner",e)}p||m.push(o)}return a=e.split(/,\s*/),Va.each(a,(function(e){var a,o,l=e.toLowerCase(),p=0,g="",b="",h="",y=0,v="";try{if(!(o=e.match(/\s*([+\-]\d+)\s*(?:on|to)?\s*([\w]+)\s*([\w\s]+)?\s*(\([^)]*\))?/)))return void((d=Va.find(i,(function(e){return l.indexOf(e)>=0})))&&(u=Va.find(r,(function(e){return l.indexOf(e)>=0})))?_[d.toLowerCase()]=u:m.push(e));if(h=o[3],p=parseInt(o[1],10)||0,g=o[2],!Va.contains(i,g.toLowerCase())){if(!(d=Va.find(c,(function(e){return l.indexOf(e)>=0})))||d.length<1)return void m.push(e);t=d.split(/\s/),g=(t=Va.map(t,(function(e){return"of"===e?"of":e[0].toUpperCase()+e.slice(1)}))).join("-"),h=h.slice(d.length-d.indexOf(" ")+1)}if(h)return void m.push(e);if(a=g[0].toUpperCase()+g.slice(1),!o[4])return void(f[a]=p);h=o[4].replace(/^\s+|\(|\)|\s+$/g,""),Va.contains(s,g.toLowerCase())?(h=h[0].toUpperCase()+h.slice(1),"knowledge"===g.toLowerCase()?a+="-"+h:a+="["+h+"]",f[a]=p):(o=h.match(/([+\-]\d+)\s(.*)$/))&&o[1]?(y=parseInt(o[1],10)||0,o[2]&&(v=o[2]),y-=p,f[a]=p,b=(y>0?"+":"")+y+" "+a+" "+v,m.push(b)):m.push(e)}catch(t){n().error("parseSkillRacialBonuses outer error",t),m.push(e)}})),g}(e.racial_mods_compendium)),D&&Va.size(D)>0&&function(e,t,a,r,i,s,c,o){var l=pi,u="";try{o=o||{},n().info("PFNPC createSkillEntries sizemap is: ",e,t,a,r,i,s,c),t&&(t.abilitymods&&Va.size(t.abilitymods)>0&&(l=Va.extend({},pi,t.abilitymods)),t.skillmods&&Va.size(t.skillmods)>0&&Va.each(t.skillmods,(function(e,t){"Knowledge"===t?Va.each(ai,(function(t){o[t+"-racial"]=e})):Va.contains(Hr,t)?Va.each(li[t],(function(t){o[t+"-racial"]=e})):o[t+"-racial"]=e})),t.skillnotes&&t.skillnotes.length>0&&(u="",Va.each(t.skillnotes,(function(e){u+=e+", "})),u.replace(/,\s$/,""),u&&(o["Skill-notes"]=u))),r&&Va.size(r)>0&&(r.intimidatingprowess&&(o["Intimidate-feat"]=a.str.mod),r.skillfocuses&&Va.each(r.skillfocuses,(function(e){"Knowledge"===e?Va.each(ai,(function(e){o[e+"-feat"]=3})):Va.contains(Hr,e)?Va.each(li[e],(function(e){o[e+"-feat"]=3})):o[e+"-feat"]=3}))),i&&Va.size(i)>0&&Va.each(i,(function(e){try{"Knowledge"===e?Va.each(ai,(function(e){o[e+"-cs"]=3})):Va.contains(Hr,e)?Va.each(li[e],(function(e){o[e+"-cs"]=3})):o[e+"-cs"]=3}catch(e){n().error("createSkillEntries",e)}})),Va.each(e,(function(e,r){var i="",c=0,u=0;try{e=parseInt(e,10)||0,l[r]?(i=l[r],c=a[i]?a[i].mod:0,o[r+"-ability"]=i.toUpperCase()+"-mod",o[r+"-ability-mod"]=c,o[r]=e,u=e,"Stealth"===r&&n().debug("skilltot 1:"+u),u-=c,"Stealth"===r&&n().debug("skilltot 2 minus  "+c+" =:"+u),"Stealth"===r?(0!==s.skillSize&&(u-=2*s.skillSize),n().debug("skilltot 3 minus  "+2*s.skillSize+" =:"+u)):"Fly"===r&&0!==s.skillSize&&(u-=s.skillSize),t&&t.skillmods&&t.skillmods[r]&&(u-=parseInt(t.skillmods[r],10)||0,"Stealth"===r&&n().debug("skilltot 4 minus  "+(parseInt(t.skillmods[r],10)||0)+" =:"+u)),parseInt(o[r+"-feat"],10)>0&&(u-=3,"Stealth"===r&&n().debug("skilltot 5 minus 3 =:"+u)),u>0&&parseInt(o[r+"-cs"],10)>0&&(u-=3,"Stealth"===r&&n().debug("skilltot 6 minus 3 =:"+u)),"Stealth"===r&&n().debug("skilltot 7 final ranks are :"+u),o[r+"-ranks"]=u,u<0&&(o[r+"-note"]="Ranks less than 0, possible parse error or error in statblock")):(n().warn("createSkillEntries, skill "+r+" not found"),o[r+"-note"]=(o[r+"-note"]||"")+", "+r+":"+e)}catch(e){n().error("createSkillEntries inner reduce",e)}}))}catch(e){n().error("at createskillEntries OUTER error",e)}finally{return n().info("leaving createskills:",o),o}}(D,E,A,S,u,C,q,w))}catch(e){n().error("importFromCompendium outer at end",e)}finally{Va.size(w)||Va.size(K)?(w.npc_import_now=0,w["npc-compimport-show"]=0,w.modify_dmg_by_size=1,w.use_buff_bonuses=1,Z&&(w.is_newsheet=1,w.recalc1=1),Ja(w,o.silentParams,(function(){var e;n().notice("##### finished settings now done"),e=Z,n().info("##############################################"),n().info("Leaving importFromCompendium"),e&&ju(!0),"function"==typeof t&&t()}))):(w.npc_import_now=0,w["npc-compimport-show"]=0,Ja(w,o.silentParams,r))}}))}on("change:npc_import_now",n().callback((function(e){"player"!==e.sourceType&&"api"!==e.sourceType||(n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),getAttrs(["npc_import_now"],(function(e){1===parseInt(e.npc_import_now,10)&&op()})))}))),on("change:add_template",n().callback((function(e){n().debug("caught "+e.sourceAttribute+" event: "+e.sourceType),"player"!==e.sourceType&&"api"!==e.sourceType||getAttrs(["template_to_add","add_template"],(function(e){var t;parseInt(e.add_template,10)&&("giant"===(t=e.template_to_add)?getAttrs(["npc-type","size","AC-natural","is_undead","npc-cr","STR-base","STR","STR-mod","CON-base","CON","CON-mod","DEX-base","DEX","DEX-mod"],(function(e){var t,a={},n=0;t=Qa("giant"),a["npc-type"]=t+" "+e["npc-type"],a=qo("STR",4,e,a),a=qo("DEX",-2,e,a),a=parseInt(e.is_undead,10)?qo("CHA",4,e,a):qo("CON",4,e,a),n=parseInt(e["AC-natural"],10)||0,n+=3,a["AC-natural"]=n,n=parseInt(e["npc-cr"],10)||0,n++,a["npc-cr"]=n,Ja(a=Kc(1,e,0,a),o.silentParams,Uu)})):"giantremove"===t?getAttrs(["npc-type","size","AC-natural","is_undead","npc-cr","STR-base","STR","STR-mod","CON-base","CON","CON-mod","DEX-base","DEX","DEX-mod"],(function(e){var t,a={},n=0;t=Qa("giant")+" ",e["npc-type"]&&(a["npc-type"]=e["npc-type"].replace(t,"")),a=qo("STR",-4,e,a),a=qo("DEX",2,e,a),a=parseInt(e.is_undead,10)?qo("CHA",-4,e,a):qo("CON",-4,e,a),n=parseInt(e["AC-natural"],10)||0,n-=3,a["AC-natural"]=n,n=parseInt(e["npc-cr"],10)||0,n--,a["npc-cr"]=n,Ja(a=Kc(-1,e,0,a),o.silentParams,Uu)})):"young"===t?getAttrs(["npc-type","size","AC-natural","is_undead","npc-cr","STR-base","STR","STR-mod","CON-base","CON","CON-mod","DEX-base","DEX","DEX-mod"],(function(e){var t,a={},n=0;t=Qa("young"),a["npc-type"]=t+" "+e["npc-type"],a=qo("STR",-4,e,a),a=qo("DEX",4,e,a),a=parseInt(e.is_undead,10)?qo("CHA",-4,e,a):qo("CON",-4,e,a),n=parseInt(e["AC-natural"],10)||0,n=Math.max(0,n-2),a["AC-natural"]=n,n=parseInt(e["npc-cr"],10)||0,--n<=0&&(n=".5"),a["npc-cr"]=n,Ja(a=Kc(-1,e,0,a),o.silentParams,Uu)})):"youngremove"===t?getAttrs(["npc-type","size","AC-natural","is_undead","npc-cr","STR-base","STR","STR-mod","CON-base","CON","CON-mod","DEX-base","DEX","DEX-mod"],(function(e){var t,a={},n=0;t=Qa("young")+" ",e["npc-type"]&&(a["npc-type"]=e["npc-type"].replace(t,"")),a=qo("STR",4,e,a),a=qo("DEX",-4,e,a),a=parseInt(e.is_undead,10)?qo("CHA",4,e,a):qo("CON",4,e,a),n=parseInt(e["AC-natural"],10)||0,n+=2,a["AC-natural"]=n,n=parseInt(e["npc-cr"],10)||0,n++,a["npc-cr"]=n,Ja(a=Kc(1,e,0,a),o.silentParams,Uu)})):"advanced"===t?getAttrs(["npc-type","size","is_undead","AC-natural","npc-cr","STR-base","STR","STR-mod","CON-base","CON","CON-mod","DEX-base","DEX","DEX-mod","INT-base","INT","INT-mod","WIS-base","WIS","WIS-mod","CHA-base","CHA","CHA-mod"],(function(e){var t,a={},n=0;t=Qa("advanced"),a["npc-type"]=t+" "+e["npc-type"],a=qo("STR",4,e,a),parseInt(e.is_undead,10)||(a=qo("CON",4,e,a)),a=qo("DEX",4,e,a),parseInt(e["INT-base"])>2&&(a=qo("INT",4,e,a)),a=qo("WIS",4,e,a),a=qo("CHA",4,e,a),n=parseInt(e["AC-natural"],10)||0,n+=2,a["AC-natural"]=n,n=parseInt(e["npc-cr"],10)||0,n++,a["npc-cr"]=n,Ja(a,o.silentParams,Uu)})):"degenerate"===t?getAttrs(["npc-type","size","is_undead","AC-natural","npc-cr","STR-base","STR","STR-mod","CON-base","CON","CON-mod","DEX-base","DEX","DEX-mod","INT-base","INT","INT-mod","WIS-base","WIS","WIS-mod","CHA-base","CHA","CHA-mod"],(function(e){var t,a={},n=0;t=Qa("degenerate"),a["npc-type"]=t+" "+e["npc-type"],a=qo("STR",-4,e,a),parseInt(e.is_undead,10)||(a=qo("CON",-4,e,a)),a=qo("DEX",-4,e,a),a=qo("INT",-4,e,a),a=qo("WIS",-4,e,a),a=qo("CHA",-4,e,a),n=parseInt(e["AC-natural"],10)||0,n-=2,a["AC-natural"]=n,n=parseInt(e["npc-cr"],10)||0,--n<=0&&(n=".5"),a["npc-cr"]=n,Ja(a,o.silentParams,Uu)})):"celestial"!==t&&"fiendish"!==t&&"entropic"!==t&&"resolute"!==t||getAttrs(["npc-type","npc-cr","npc-hd","DR","SR-macro-text","SR","resistances","vision","CHA-mod"],(function(e){var a,n={},r="",i="",s=0,c=0,l="";r=Qa(t),n["npc-type"]=r+" "+e["npc-type"],a=parseInt(e["npc-hd"],10)||0,/darkvision/i.test(e.vision)||(r=(r=Qa("darkvision"))+" 60"+getTranslationByKey("feet-abbrv"),e.vision&&(r=r+" "+e.vision),n.vision=r),"celestial"===t?(i="Evil",r="Resist Cold, Acid, Electricity "):"fiendish"===t?(i="Good",r="Resist Cold and Fire "):"entropic"===t?(i="Lawful",r="Resist Acid and Fire "):"resolute"===t&&(i="chaotic",r="Resist Acid, Cold, and Fire "),r+=a<5?" 5;":a>=5&&a<=10?" 10;":" 15;",n.resistances=r+(e.resistances||""),r="",a>=5&&a<=10?r="5/"+i+";":a>10&&(r="10/"+i+";"),r&&(n.DR=r+(e.DR||"")),s=parseInt(e["npc-cr"],10)||0,a>=5&&(s++,n["npc-cr"]=c),(c=parseInt(e.SR,10)||0)<s+5&&(r=(e["SR-macro-text"]||"")+"+5",n["SR-macro-text"]="@{npc-cr}+5",n.SR=s+5),n[(l="repeating_ability_"+generateRowID()+"_")+"name"]="Smite "+i,n[l+"ability_type"]="Su",n[l+"rule_category"]="monster-rule",n[l+"showinmenu"]="1",n[l+"description"]="smite "+i+" 1/day as a swift action (adds Cha bonus to attack rolls and damage bonus equal to HD against "+i+" foes; smite persists until target is dead or the celestial creature rests).",n[l+"short-description"]="Enable in buff list against 1 evil creature",n[l+"frequency"]="perday",n[l+"max-calculation"]="1",n[l+"used_max"]=1,n[(l="repeating_buff2_"+generateRowID()+"_")+"name"]="Smite "+i+" (Su) 1/day",n[l+"b1_bonus"]="attack",n[l+"b1_bonustype"]="untyped",n[l+"b1_macro-text"]="@{CHA-mod}",n[l+"b1_val"]=parseInt(e["CHA-mod"],10),n[l+"b2_bonus"]="attack",n[l+"b2_bonustype"]="untyped",n[l+"b2_macro-text"]="@{npc-hd}",n[l+"b2_val"]=parseInt(e["npc-hd"],10),n[l+"notes"]="vs one "+i+" creature",Ja(n,o.silentParams,Uu)})),Ja({template_to_add:"",add_template:0},o.silentParams))}))}))),n().config({logging:{info:!1,debug:!1}}),c("       ,## /##                    "),c("      /#/ /  ##                   "),c("     / / /    ##                  "),c("      | ##___#/                   "),c("      | ##       athfinder        "),c("   #  | ##    sheet version       "),c("    ### /           "+("0000"+o.version.toFixed(2)).slice(-5)+"         "),c("                                  ")})()})();