//------------------------------------------------------------------------------
//
// Eschersketch - A drawing program for exploring symmetrical designs
//
//
// Copyright (c) 2017 Anselm Levskaya (http://anselmlevskaya.com)
// Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
// license.
//
//------------------------------------------------------------------------------

// DRAWING GLOBALS
import {gS,
        livecanvas, lctx, canvas, ctx,
        affineset, updateSymmetry, updateStyle, drawKeyToOrderMap,
        commitOp
       } from './main';
import _ from 'underscore';
import {add2, sub2, scalar2, normalize, l2norm, l2dist,
        reflectPoint, angleBetween, orthoproject2, pointToAngle} from './math_utils';

import {RotationAbout, RotationTransform, ScalingTransform} from './symmetryGenerator';

import {drawHitCircle} from './canvas_utils';


// Draw Circles, Ellipses, Arc-segments
//------------------------------------------------------------------------------
export class CircleOp {
  constructor(symmState, ctxStyle, points, options) {
    this.tool = "circle";
    this.points = points;
    this.options = options;
    this.ctxStyle = ctxStyle;
    this.symmState = symmState;
  }

  render(ctx){
    _.assign(ctx, this.ctxStyle);
    updateSymmetry(this.symmState);
    const drawOrder = drawKeyToOrderMap[this.ctxStyle.drawOrder]; // optional separation of stroke / fill layers
    for(let drawSet of drawOrder){
      for (let af of affineset) {
        const Tp0 = af.on(this.points[0][0], this.points[0][1]);
        const Tp1 = af.on(this.points[1][0], this.points[1][1]);
        const Tp2 = af.on(this.points[2][0], this.points[2][1]);
        let Tmajor = l2dist(Tp0,Tp1);
        let Tminor = l2dist(Tp0,Tp2);
        let angle = pointToAngle(Tp0,Tp1);
        ctx.beginPath();
        ctx.ellipse(Tp0[0], Tp0[1], Tmajor, Tminor, angle, 0, Math.PI/180.0 * this.options.arcAngle,0);
        for(let drawFunc of drawSet){ //drawFunc = "stroke" or "fill"
          ctx[drawFunc]();
        }
      }
    }
  }
}

const bakeOptions = function(options){
  let simpleOptions = {};
  for(let key of Object.keys(options)){
    simpleOptions[key] = options[key].val;
  }
  return simpleOptions;
}

//State Labels
const _INIT_ = 0;
const _OFF_  = 1;
const _ON_   = 2;
const _MOVECENTER_ = 3;
const _MOVEMAJOR_ = 4;
const _MOVEMINOR_ = 5;
const _MOVEARC_ = 6;

export class CircleTool {
  constructor() {
    this.points = [[0,0],[0,0],[0,0]];
    this.state = _INIT_;
    this.hitRadius = 4;
    this.actions = [
      {name: "cancel", desc: "cancel ellipse", icon: "icon-cross", key: "Escape"},
      {name: "commit", desc: "start new (automatic on new click)", icon: "icon-checkmark", key: "Enter"},
    ];
    this.options = {
        arcAngle: {val: 360, type: "slider", min:1, max:360, step:1},
    }
  }

  liverender() {
    lctx.clearRect(0, 0, canvas.width, canvas.height);
    //const drawOrder = [["stroke"], ["fill"]];
    const drawOrder = drawKeyToOrderMap[gS.ctxStyle.drawOrder]; // optional separation of stroke / fill layers
    for(let drawSet of drawOrder){
      for (let af of affineset) {
        const Tp0 = af.on(this.points[0][0], this.points[0][1]);
        const Tp1 = af.on(this.points[1][0], this.points[1][1]);
        const Tp2 = af.on(this.points[2][0], this.points[2][1]);
        let Tmajor = l2dist(Tp0,Tp1);
        let Tminor = l2dist(Tp0,Tp2);
        let angle = pointToAngle(Tp0,Tp1);
        lctx.beginPath();
        lctx.ellipse(Tp0[0], Tp0[1], Tmajor, Tminor, angle, 0, Math.PI/180.0*this.options.arcAngle.val,0);
        for(let drawFunc of drawSet){ //drawFunc = "stroke" or "fill"
          lctx[drawFunc]();
        }
        //lctx.stroke();
        //lctx.fill();
      }
    }
    drawHitCircle(lctx, this.points[0][0]-0.5, this.points[0][1]-0.5, this.hitRadius);
    drawHitCircle(lctx, this.points[1][0]-0.5, this.points[1][1]-0.5, this.hitRadius);
    drawHitCircle(lctx, this.points[2][0]-0.5, this.points[2][1]-0.5, this.hitRadius);
  }

  enter(op){
    if(op){
        updateStyle(op.ctxStyle);
        updateSymmetry(op.symmState);
        for(let key of Object.keys(op.options)){
          this.options[key].val = op.options[key];
        }
        this.points = op.points;
        this.state = _OFF_;
        this.liverender();
    } else{
      this.points = [[0,0],[0,0],[0,0]];
      this.state = _INIT_;
    }
  }

  exit(){
      this.points = [[0,0],[0,0],[0,0]];
      this.state = _INIT_;
  }

  commit() {
    if(this.state == _INIT_){return;}
    let ctxStyle = _.clone(gS.ctxStyle);
    let symmState = _.clone(gS.symmState);
    commitOp(new CircleOp(symmState, ctxStyle, this.points, bakeOptions(this.options)));
    lctx.clearRect(0, 0, livecanvas.width, livecanvas.height);
    this.points = [[0,0],[0,0],[0,0]];
    this.state = _INIT_;
  }

  cancel() {
    lctx.clearRect(0, 0, livecanvas.width, livecanvas.height);
    this.points = [[0,0],[0,0],[0,0]];
    this.state = _INIT_;
  }

  mouseDown(e) {
    let rect = livecanvas.getBoundingClientRect();
    let pt = [e.clientX-rect.left, e.clientY-rect.top];
    if(l2dist(pt, this.points[0])<this.hitRadius) {
      this.state = _MOVECENTER_;
    } else if(l2dist(pt, this.points[1])<this.hitRadius) {
      this.state = _MOVEMAJOR_;
    } else if(l2dist(pt, this.points[2])<this.hitRadius) {
      this.state = _MOVEMINOR_;
    } else {
      if(this.state==_OFF_) {
        this.commit();
      }
      this.state = _ON_;
      this.points = [pt, pt, pt];
    }
  }

  mouseMove(e) {
    let rect = livecanvas.getBoundingClientRect();
    let pt = [e.clientX-rect.left, e.clientY-rect.top];
    if (this.state == _ON_) {
        this.points[1] = pt;
        this.points[2] = [-(pt[1]-this.points[0][1])+this.points[0][0],
                           (pt[0]-this.points[0][0])+this.points[0][1]]; //90deg CCW rotation of pt around points[0]
        this.liverender();
    }
    else if (this.state == _MOVECENTER_) {
      let delt = sub2(pt, this.points[0]);
      let newmajor = add2(this.points[1],delt);
      let newminor = add2(this.points[2],delt);
      this.points = [pt, newmajor, newminor];
      this.liverender();
    }
    else if (this.state == _MOVEMAJOR_) {
      let theta = angleBetween(this.points[0], this.points[1], pt);
      let rotM  = RotationAbout(-theta, this.points[0][0], this.points[0][1]);
      let scale = l2norm(sub2(pt,this.points[0])) / (l2norm(sub2(this.points[1],this.points[0])) + 1.0e-9); //XXX: NaN edgecase?
      this.points[1] = pt;
      let Rpt2 = rotM.onVec(this.points[2]);
      this.points[2] = add2(scalar2(sub2(Rpt2,this.points[0]), scale), this.points[0]);
      this.liverender();
    }
    else if (this.state == _MOVEMINOR_) {
      this.points[2] = orthoproject2(this.points[0], this.points[1], pt);
      this.liverender();
    }
  }

  mouseUp(e) {
    if(this.state===_INIT_){return;} //edgecase of accidental mouseup before drawing
    this.state = _OFF_;
  }

  keyDown(e) {
    if(e.target.type){return;} // don't interfere with input UI key-events
    for(let action of this.actions){
      if(action.key == e.code){
        this[action.name]();
      }
    }
  }

}
