var Benchmark = require('benchmark'),
    suite = new Benchmark.Suite(),
    loadVT = require('../index'),
    loadVT2 = require('../variations/one'),
    polyline = require('polyline');

suite.add({
    defer: true,
    name: 'original',
    fn: function(deferred) {
        var p = decodeURIComponent('w_pfFt%60elVq%40BaBhBc%40z%40ElAP~%40Qt%40ObAg%40fAU~AW%60Am%40TeAc%40%7D%40BGq%40Dv%40n%40Z~%40Zx%40bATzAMxA%5BpAQtAW%7CAGxA%7B%40rCw%40e%40%7B%40U%7B%40LYnADnAzBvA%5CdAWjAaBlBEhAOrAMnDYnDKpA%5DhAItAFrAJtAQtA%7B%40bAiALg%40%7D%40e%40kAaA_%40_ASeABm%40m%40e%40_AoBkAEhANpDx%40v%40HvAA~A%5DhAm%40k%40MuAsBgAy%40L_AQPeGCqAi%40gAA_ABqA_%40mAc%40s%40m%40u%40_Ag%40_A%40%7B%40K%7B%40Wu%40c%40q%40Y_AM%7B%40W%7D%40Hy%40MaAWs%40i%40_AFm%40r%40y%40n%40sBfAy%40%5Cy%40d%40%7DBdA_A%5C_ANaAJ%7B%40Zw%40l%40yAtBc%40dAQnAYbAm%40r%40c%40hAoAdF%5DlA%5BrA%5D~%40c%40dAQnABrAApANdAItAHhATfATlAl%40z%40j%40~%40%7CAbFNjANhDYjAWjA%40nAFjA_AhCWdAc%40bAu%40p%40g%40~%40%5DdAg%40bA%7B%40%7CC_%40dAc%40xAWtAKrA%5EfAAt%40Cl%40YxAC%7CCGpAPlA~%40dCj%40x%40lApAYp%40k%40n%40s%40l%40s%40NW%7C%40WZEt%40g%40l%40Ff%40RN%60ABXWLEHNKAE%5C_%40Gs%40JI%5BMPI_%40Bw%40d%40%5DNu%40ZaAn%40_%40t%40Uj%40s%40Xm%40Yo%40%5Bi%40_%40iAa%40%7D%40g%40%7B%40%5BmAAcDHoA%40sAf%40w%40YgAMoANsAt%40_D%60%40cAVmA%5CcAf%40gAh%40%7D%40TgAr%40e%40h%40y%40ZeAViAf%40q%40KwAj%40mDJkACwA%5DiDe%40cA_%40oAm%40iAo%40%7D%40MkA_%40wAYyAJuAK%7DFNsA%60%40aAf%40uCn%40wCPqA%60%40iAf%40cAr%40w%40%5CiANkAXgAj%40%7B%40f%40cA%7C%40_%40~%40_%40xBg%40%7C%40Qv%40c%40z%40Y%7C%40c%40r%40e%40z%40_%40x%40g%40%7C%40a%40l%40%7B%40t%40Y%60C%7C%40x%40%5EbAQx%40H%7C%40N~%40B%5CfA%60A%3FtBd%40%60AFz%40Vt%40f%40NlABjAKpAh%40x%40XfAM~COpA%40hAz%40d%40~%40Wz%40j%40t%40j%40NhAv%40ZPiA%40wAIsAu%40q%40%3FwAKsA%3FiA%5Ct%40bC~%40n%40l%40z%40J~%40%5Cp%40h%40h%40%7C%40l%40x%40%60AE%7C%40k%40TiADuAWmACwAPkAZiATsAN%7DC%40gDXoADcA~AoBZkAWiAu%40i%40y%40%5D_%40mATiAp%40s%40z%40Pz%40Zn%40YJmALsAAiA%5CgATeARgANoAKsAm%40_Au%40i%40_A_%40c%40m%40zBG%60ABt%40u%40dA%7DCJsAOoA%40sAj%40y%40t%40g%40p%40o%40');
        loadVT(polyline.decode(p), function(err, res) {
            deferred.resolve();
        });
    }
})
.add({
    defer: true,
    name: 'one',
    fn: function(deferred) {
        var p = decodeURIComponent('w_pfFt%60elVq%40BaBhBc%40z%40ElAP~%40Qt%40ObAg%40fAU~AW%60Am%40TeAc%40%7D%40BGq%40Dv%40n%40Z~%40Zx%40bATzAMxA%5BpAQtAW%7CAGxA%7B%40rCw%40e%40%7B%40U%7B%40LYnADnAzBvA%5CdAWjAaBlBEhAOrAMnDYnDKpA%5DhAItAFrAJtAQtA%7B%40bAiALg%40%7D%40e%40kAaA_%40_ASeABm%40m%40e%40_AoBkAEhANpDx%40v%40HvAA~A%5DhAm%40k%40MuAsBgAy%40L_AQPeGCqAi%40gAA_ABqA_%40mAc%40s%40m%40u%40_Ag%40_A%40%7B%40K%7B%40Wu%40c%40q%40Y_AM%7B%40W%7D%40Hy%40MaAWs%40i%40_AFm%40r%40y%40n%40sBfAy%40%5Cy%40d%40%7DBdA_A%5C_ANaAJ%7B%40Zw%40l%40yAtBc%40dAQnAYbAm%40r%40c%40hAoAdF%5DlA%5BrA%5D~%40c%40dAQnABrAApANdAItAHhATfATlAl%40z%40j%40~%40%7CAbFNjANhDYjAWjA%40nAFjA_AhCWdAc%40bAu%40p%40g%40~%40%5DdAg%40bA%7B%40%7CC_%40dAc%40xAWtAKrA%5EfAAt%40Cl%40YxAC%7CCGpAPlA~%40dCj%40x%40lApAYp%40k%40n%40s%40l%40s%40NW%7C%40WZEt%40g%40l%40Ff%40RN%60ABXWLEHNKAE%5C_%40Gs%40JI%5BMPI_%40Bw%40d%40%5DNu%40ZaAn%40_%40t%40Uj%40s%40Xm%40Yo%40%5Bi%40_%40iAa%40%7D%40g%40%7B%40%5BmAAcDHoA%40sAf%40w%40YgAMoANsAt%40_D%60%40cAVmA%5CcAf%40gAh%40%7D%40TgAr%40e%40h%40y%40ZeAViAf%40q%40KwAj%40mDJkACwA%5DiDe%40cA_%40oAm%40iAo%40%7D%40MkA_%40wAYyAJuAK%7DFNsA%60%40aAf%40uCn%40wCPqA%60%40iAf%40cAr%40w%40%5CiANkAXgAj%40%7B%40f%40cA%7C%40_%40~%40_%40xBg%40%7C%40Qv%40c%40z%40Y%7C%40c%40r%40e%40z%40_%40x%40g%40%7C%40a%40l%40%7B%40t%40Y%60C%7C%40x%40%5EbAQx%40H%7C%40N~%40B%5CfA%60A%3FtBd%40%60AFz%40Vt%40f%40NlABjAKpAh%40x%40XfAM~COpA%40hAz%40d%40~%40Wz%40j%40t%40j%40NhAv%40ZPiA%40wAIsAu%40q%40%3FwAKsA%3FiA%5Ct%40bC~%40n%40l%40z%40J~%40%5Cp%40h%40h%40%7C%40l%40x%40%60AE%7C%40k%40TiADuAWmACwAPkAZiATsAN%7DC%40gDXoADcA~AoBZkAWiAu%40i%40y%40%5D_%40mATiAp%40s%40z%40Pz%40Zn%40YJmALsAAiA%5CgATeARgANoAKsAm%40_Au%40i%40_A_%40c%40m%40zBG%60ABt%40u%40dA%7DCJsAOoA%40sAj%40y%40t%40g%40p%40o%40');
        loadVT2(polyline.decode(p), function(err, res) {
            deferred.resolve();
        });
    }
})
.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})
.run({ 'async': true });
