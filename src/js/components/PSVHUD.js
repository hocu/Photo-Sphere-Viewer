/**
 * HUD class
 * @param {PhotoSphereViewer} psv
 * @constructor
 */
function PSVHUD(psv) {
  PSVComponent.call(this, psv);

  this.$svg = null;
  this.markers = {};

  this.prop = {
    frustrumPoints: []
  };
  this.currentMarker = null;
  this.hoveringMarker = null;

  this.create();
}

PSVHUD.prototype = Object.create(PSVComponent.prototype);
PSVHUD.prototype.constructor = PSVHUD;

PSVHUD.className = 'psv-hud';
PSVHUD.publicMethods = [
  'addMarker',
  'removeMarker',
  'updateMarker',
  'clearMarkers',
  'getMarker',
  'getCurrentMarker',
  'gotoMarker',
  'hideMarker',
  'showMarker',
  'toggleMarker'
];

PSVHUD.svgNS = 'http://www.w3.org/2000/svg';

/**
 * Creates the HUD
 */
PSVHUD.prototype.create = function() {
  PSVComponent.prototype.create.call(this);

  this.$svg = document.createElementNS(PSVHUD.svgNS, 'svg');
  this.$svg.setAttribute('class', 'psv-svg-container');
  this.container.appendChild(this.$svg);

  // Markers events via delegation
  this.container.addEventListener('mouseenter', this, true);
  this.container.addEventListener('mouseleave', this, true);
  this.container.addEventListener('mousemove', this, true);

  // Viewer events
  this.psv.on('click', this);
  this.psv.on('render', this);
};

/**
 * Destroys the HUD
 */
PSVHUD.prototype.destroy = function() {
  this.clearMarkers(false);

  this.container.removeEventListener('mouseenter', this);
  this.container.removeEventListener('mouseleave', this);
  this.container.removeEventListener('mousemove', this);

  this.psv.off('click', this);
  this.psv.off('render', this);

  delete this.$svg;

  PSVComponent.prototype.destroy.call(this);
};

/**
 * Handle events
 * @param {Event} e
 * @private
 */
PSVHUD.prototype.handleEvent = function(e) {
  switch (e.type) {
    // @formatter:off
    case 'mouseenter':  this._onMouseEnter(e);        break;
    case 'mouseleave':  this._onMouseLeave(e);        break;
    case 'mousemove':   this._onMouseMove(e);         break;
    case 'click':       this._onClick(e.args[0], e);  break;
    case 'render':      this.updatePositions();       break;
    // @formatter:on
  }
};

/**
 * Add a new marker to HUD
 * @param {Object} properties
 * @param {boolean} [render=true]
 * @returns {PSVMarker}
 */
PSVHUD.prototype.addMarker = function(properties, render) {
  if (!properties.id) {
    throw new PSVError('missing marker id');
  }

  if (this.markers[properties.id]) {
    throw new PSVError('marker "' + properties.id + '" already exists');
  }

  var marker = new PSVMarker(properties, this.psv);

  if (marker.isNormal()) {
    this.container.appendChild(marker.$el);
  }
  else {
    this.$svg.appendChild(marker.$el);
  }

  this.markers[marker.id] = marker;

  if (render !== false) {
    this.updatePositions();
  }

  return marker;
};

/**
 * Get a marker by it's id or external object
 * @param {*} marker
 * @returns {PSVMarker}
 */
PSVHUD.prototype.getMarker = function(marker) {
  var id = typeof marker === 'object' ? marker.id : marker;

  if (!this.markers[id]) {
    throw new PSVError('cannot find marker "' + id + '"');
  }

  return this.markers[id];
};

/**
 * Get the current selected marker
 * @returns {PSVMarker}
 */
PSVHUD.prototype.getCurrentMarker = function() {
  return this.currentMarker;
};

/**
 * Update a marker
 * @param {*} marker
 * @param {boolean} [render=true]
 * @returns {PSVMarker}
 */
PSVHUD.prototype.updateMarker = function(input, render) {
  var marker = this.getMarker(input);

  marker.update(input);

  if (render !== false) {
    this.updatePositions();
  }

  return marker;
};

/**
 * Remove a marker
 * @param {*} marker
 * @param {boolean} [render=true]
 */
PSVHUD.prototype.removeMarker = function(marker, render) {
  marker = this.getMarker(marker);

  if (marker.isNormal()) {
    this.container.removeChild(marker.$el);
  }
  else {
    this.$svg.removeChild(marker.$el);
  }

  if (this.hoveringMarker == marker) {
    this.psv.tooltip.hideTooltip();
  }

  delete this.markers[marker.id];

  if (render !== false) {
    this.updatePositions();
  }
};

/**
 * Remove all markers
 * @param {boolean} [render=true]
 */
PSVHUD.prototype.clearMarkers = function(render) {
  Object.keys(this.markers).forEach(function(marker) {
    this.removeMarker(marker, false);
  }, this);

  if (render !== false) {
    this.updatePositions();
  }
};

/**
 * Go to a specific marker
 * @param {*} marker
 * @param {string|int} [duration]
 */
PSVHUD.prototype.gotoMarker = function(marker, duration) {
  marker = this.getMarker(marker);
  this.psv.animate(marker, duration);
};

/**
 * Hide a marker
 * @param {*} marker
 */
PSVHUD.prototype.hideMarker = function(marker) {
  this.getMarker(marker).visible = false;
  this.updatePositions();
};

/**
 * Show a marker
 * @param {*} marker
 */
PSVHUD.prototype.showMarker = function(marker) {
  this.getMarker(marker).visible = true;
  this.updatePositions();
};

/**
 * Toggle a marker
 * @param {*} marker
 */
PSVHUD.prototype.toggleMarker = function(marker) {
  this.getMarker(marker).visible ^= true;
  this.updatePositions();
};

/**
 * Update visibility and position of all markers
 */
PSVHUD.prototype.updatePositions = function() {
  var rotation = !this.psv.isGyroscopeEnabled() ? 0 : this.psv.camera.rotation.z / Math.PI * 180;

  this.prop.fovBounds = {
    longitude1: PSVUtils.parseAngle(this.psv.prop.longitude - this.psv.prop.hFov * PSVUtils.Deg2Rad / 2),
    longitude2: PSVUtils.parseAngle(this.psv.prop.longitude + this.psv.prop.hFov * PSVUtils.Deg2Rad / 2),
    latitude1: this.psv.prop.latitude - this.psv.prop.vFov * PSVUtils.Deg2Rad / 2,
    latitude2: this.psv.prop.latitude + this.psv.prop.vFov * PSVUtils.Deg2Rad / 2,
    latitudeCrossOrigin: false
  };

  this.prop.fovBounds.latitudeCrossOrigin = this.prop.fovBounds.latitude1 > this.prop.fovBounds.latitude2;


  this.prop.frustrumPoints = [
    this.psv.sphericalCoordsToVector3(this.prop.fovBounds.longitude1, this.prop.fovBounds.latitude2),
    this.psv.sphericalCoordsToVector3(this.prop.fovBounds.longitude2, this.prop.fovBounds.latitude2),
    this.psv.sphericalCoordsToVector3(this.prop.fovBounds.longitude2, this.prop.fovBounds.latitude1),
    this.psv.sphericalCoordsToVector3(this.prop.fovBounds.longitude1, this.prop.fovBounds.latitude1)
  ];

  for (var id in this.markers) {
    var marker = this.markers[id];

    if (marker.isPolygon()) {
      var positions = this._getPolygonPositions(marker);

      if (this._isPolygonVisible(marker, positions)) {
        marker.position2D = this._getPolygonDimensions(marker, positions);

        var points = '';
        positions.forEach(function(pos) {
          points += pos.left + ',' + pos.top + ' ';
        });

        marker.$el.setAttributeNS(null, 'points', points);

        if (!marker.$el.classList.contains('visible')) {
          marker.$el.classList.add('visible');
        }
      }
      else {
        marker.position2D = null;
        marker.$el.classList.remove('visible');
      }
    }
    else {
      var position = this._getMarkerPosition(marker);

      if (this._isMarkerVisible(marker, position)) {
        marker.position2D = position;

        marker.$el.style.transform = 'translate3D(' + position.left + 'px, ' + position.top + 'px, ' + '0px) rotateZ(' + rotation + 'deg)';

        if (!marker.$el.classList.contains('visible')) {
          marker.$el.classList.add('visible');
        }
      }
      else {
        marker.position2D = null;
        marker.$el.classList.remove('visible');
      }
    }
  }
};

/**
 * Determine if a point marker is visible
 * It tests if the point is in the general direction of the camera, then check if it's in the viewport
 * @param {PSVMarker} marker
 * @param {{top: int, left: int}} position
 * @returns {boolean}
 * @private
 */
PSVHUD.prototype._isMarkerVisible = function(marker, position) {
  return marker.visible &&
    marker.position3D.dot(this.psv.prop.direction) > 0 &&
    position.left + marker.width >= 0 &&
    position.left - marker.width <= this.psv.prop.size.width &&
    position.top + marker.height >= 0 &&
    position.top - marker.height <= this.psv.prop.size.height;
};

/**
 * Determine if a polygon marker is visible
 * It tests if at least one point is in the viewport
 * @param {PSVMarker} marker
 * @param {{top: int, left: int}[]} positions
 * @returns {boolean}
 * @private
 */
PSVHUD.prototype._isPolygonVisible = function(marker, positions) {
  return true;
  return marker.visible &&
    positions.some(function(pos, i) {
      return marker.positions3D[i].dot(this.psv.prop.direction) > 0 &&
        pos.left >= 0 &&
        pos.left <= this.psv.prop.size.width &&
        pos.top >= 0 &&
        pos.top <= this.psv.prop.size.height;
    }, this);
};

/**
 * Compute HUD coordinates of a marker
 * @param {PSVMarker} marker
 * @returns {{top: int, left: int}}
 * @private
 */
PSVHUD.prototype._getMarkerPosition = function(marker) {
  if (marker.dynamicSize) {
    // make the marker visible to get it's size
    marker.$el.classList.add('transparent');
    var rect = marker.$el.getBoundingClientRect();
    marker.$el.classList.remove('transparent');

    marker.width = rect.right - rect.left;
    marker.height = rect.bottom - rect.top;
  }

  var position = this.psv.vector3ToViewerCoords(marker.position3D);

  position.top -= marker.height * marker.anchor.top;
  position.left -= marker.width * marker.anchor.left;

  return position;
};

/**
 * Compute HUD coordinates of each point of a polygon
 * @param {PSVMarker} marker
 * @returns {{top: int, left: int}[]}
 * @private
 */
PSVHUD.prototype._getPolygonPositions = function(marker) {
  var nbVectors = marker.positions3D.length;

  var positions = marker.polygon_rad.map(function(pos, i) {
    var visible = pos[0] > this.prop.fovBounds.latitude1 && pos[0] < this.prop.fovBounds.latitude2;

    if (visible) {
      if (this.prop.fovBounds.longitude1 > this.prop.fovBounds.longitude2) { // rendered space crosses origin
        visible &= pos[1] > this.prop.fovBounds.longitude1 || pos[1] < this.prop.fovBounds.longitude2;
      }
      else {
        visible &= pos[1] > this.prop.fovBounds.longitude1 && pos[1] < this.prop.fovBounds.longitude2;
      }
    }

    return {
      spherical: pos,
      vector: marker.positions3D[i],
      visible: visible
    };
  }, this);

  var toBeComputed = positions.reduce(function(toBeComputed, pos, i) {
    if (!pos.visible) {
      var neighbours = [
        i === 0 ? positions[nbVectors - 1] : positions[i - 1],
        i === nbVectors - 1 ? positions[0] : positions[i + 1]
      ];

      var visibleNeighbour;
      neighbours.some(function(neighbour) {
        if (neighbour.visible) {
          visibleNeighbour = neighbour;
          return true;
        }
      });

      if (visibleNeighbour) {
        toBeComputed.push({
          visible: visibleNeighbour,
          invisible: pos
        });
      }
    }

    return toBeComputed;
  }, []);

  toBeComputed.forEach(function(pair) {
    pair.invisible.vector = this._computeIntermediaryPoint(pair.visible.vector, pair.invisible.vector);
    pair.invisible.visible = !!pair.invisible.vector;
  }, this);

  return positions
    .filter(function(pos) {
      return pos.visible;
    })
    .map(function(pos) {
      return this.psv.vector3ToViewerCoords(pos.vector);
    }, this);

  /*
   // compute if each vector is visible
   var positions3D = marker.positions3D.map(function(vector) {
   return {
   vector: vector,
   visible: vector.dot(this.psv.prop.direction) > 0
   };
   }, this);

   // get pairs of visible/invisible vector for each invisible vector connected to a visible vector
   var toBeComputed = positions3D.reduce(function(toBeComputed, pos, i) {
   if (!pos.visible) {
   var neighbours = [
   i === 0 ? positions3D[nbVectors - 1] : positions3D[i - 1],
   i === nbVectors - 1 ? positions3D[0] : positions3D[i + 1]
   ];

   var visibleNeighbour;
   neighbours.some(function(neighbour) {
   if (neighbour.visible) {
   visibleNeighbour = neighbour;
   return true;
   }
   });

   if (visibleNeighbour) {
   toBeComputed.push({
   visible: visibleNeighbour,
   invisible: pos
   });
   }
   }

   return toBeComputed;
   }, []);

   // compute intermediary vector for each pair
   toBeComputed.forEach(function(pair) {
   pair.invisible.vector = this._computeIntermediaryPoint(pair.visible.vector, pair.invisible.vector);
   pair.invisible.visible = !!pair.invisible.vector;
   }, this);

   // translate vectors to screen pos
   return positions3D
   .filter(function(pos) {
   return pos.visible;
   })
   .map(function(pos) {
   return this.psv.vector3ToViewerCoords(pos.vector);
   }, this)
   .filter(function(pos) {
   return Math.abs(pos.top) < 100000 && Math.abs(pos.left) < 100000;
   });*/
};

PSVHUD.prototype._computeIntermediaryPoint = function(P1, P2) {
  var sides = [
    [this.prop.frustrumPoints[0], this.prop.frustrumPoints[1]],
    [this.prop.frustrumPoints[1], this.prop.frustrumPoints[2]],
    [this.prop.frustrumPoints[2], this.prop.frustrumPoints[3]],
    [this.prop.frustrumPoints[3], this.prop.frustrumPoints[0]]
  ];

  var result;

  sides.some(function(side) {
    var temp = this._computeArcIntersection2(P1, P2, side[0], side[1]);

    if (temp) {
      result = temp;
      return true;
    }
  }, this);

  return result;
};

PSVHUD.prototype._computeArcIntersection1 = function(b, d) {
  var n = new THREE.Vector3().crossVectors(b, d).normalize();
  var v = new THREE.Vector3().crossVectors(n, b).normalize();

  var N = this.psv.prop.direction.clone().normalize()

  var H = new THREE.Vector3().addVectors(b.clone().multiplyScalar(-N.dot(v)), v.clone().multiplyScalar(N.dot(b))).normalize();

  return H;
};

PSVHUD.prototype._computeArcIntersection2 = function(P1, P2, P3, P4) {
  var U1 = new THREE.Vector3().crossVectors(P1, P2).normalize();
  var U2 = new THREE.Vector3().crossVectors(P3, P4).normalize();

  var S1 = new THREE.Vector3().crossVectors(U1, U2).normalize();
  var S2 = S1.clone().multiplyScalar(-1);

  var S1_ = this.psv.vector3ToSphericalCoords(S1);
  var S2_ = this.psv.vector3ToSphericalCoords(S2);
  var P1_ = this.psv.vector3ToSphericalCoords(P1);
  var P2_ = this.psv.vector3ToSphericalCoords(P2);
  var P3_ = this.psv.vector3ToSphericalCoords(P3);
  var P4_ = this.psv.vector3ToSphericalCoords(P4);

  var C, C_;

  var P1_P2 = Math.acos(Math.sin(P1_.latitude) * Math.sin(P2_.latitude) + Math.cos(P1_.latitude) * Math.cos(P2_.latitude) * Math.cos(Math.abs(P1_.longitude - P2_.longitude)));

  var S1_P1 = Math.acos(Math.sin(S1_.latitude) * Math.sin(P1_.latitude) + Math.cos(S1_.latitude) * Math.cos(P1_.latitude) * Math.cos(Math.abs(S1_.longitude - P1_.longitude)));
  var S1_P2 = Math.acos(Math.sin(S1_.latitude) * Math.sin(P2_.latitude) + Math.cos(S1_.latitude) * Math.cos(P2_.latitude) * Math.cos(Math.abs(S1_.longitude - P2_.longitude)));

  if (P1_P2 - S1_P1 - S1_P2 < 1e-15) {
    C = S1;
    C_ = S1_;
  }
  else {
    var S2_P1 = Math.acos(Math.sin(S2_.latitude) * Math.sin(P1_.latitude) + Math.cos(S2_.latitude) * Math.cos(P1_.latitude) * Math.cos(Math.abs(S2_.longitude - P1_.longitude)));
    var S2_P2 = Math.acos(Math.sin(S2_.latitude) * Math.sin(P2_.latitude) + Math.cos(S2_.latitude) * Math.cos(P2_.latitude) * Math.cos(Math.abs(S2_.longitude - P2_.longitude)));

    if (P1_P2 - S2_P1 - S2_P2 < 1e-15) {
      C = S2;
      C_ = S2_;
    }
  }

  if (C) {
    var P3_P4 = Math.acos(Math.sin(P3_.latitude) * Math.sin(P4_.latitude) + Math.cos(P3_.latitude) * Math.cos(P4_.latitude) * Math.cos(Math.abs(P3_.longitude - P4_.longitude)));

    var C_P3 = Math.acos(Math.sin(C_.latitude) * Math.sin(P3_.latitude) + Math.cos(C_.latitude) * Math.cos(P3_.latitude) * Math.cos(Math.abs(C_.longitude - P3_.longitude)));
    var C_P4 = Math.acos(Math.sin(C_.latitude) * Math.sin(P4_.latitude) + Math.cos(C_.latitude) * Math.cos(P4_.latitude) * Math.cos(Math.abs(C_.longitude - P4_.longitude)));

    if (P3_P4 - C_P3 - C_P4 < 1e-15) {
      return C;
    }
  }

  return null;
};

/**
 * Compute the boundaries positions of a polygon marker
 * Alters the marker width and height
 * @param {PSVMarker} marker
 * @param {{top: int, left: int}[]} positions
 * @returns {{top: int, left: int}}
 * @private
 */
PSVHUD.prototype._getPolygonDimensions = function(marker, positions) {
  var minX = +Infinity;
  var minY = +Infinity;
  var maxX = -Infinity;
  var maxY = -Infinity;

  positions.forEach(function(pos) {
    minX = Math.min(minX, pos.left);
    minY = Math.min(minY, pos.top);
    maxX = Math.max(maxX, pos.left);
    maxY = Math.max(maxY, pos.top);
  });

  marker.width = maxX - minX;
  marker.height = maxY - minY;

  return {
    top: minY,
    left: minX
  };
};

/**
 * The mouse enters a point marker : show the tooltip
 * @param {MouseEvent} e
 * @private
 */
PSVHUD.prototype._onMouseEnter = function(e) {
  var marker;
  if (e.target && (marker = e.target.psvMarker) && marker.tooltip && !marker.isPolygon()) {
    this.hoveringMarker = marker;

    this.psv.tooltip.showTooltip({
      content: marker.tooltip.content,
      position: marker.tooltip.position,
      top: marker.position2D.top,
      left: marker.position2D.left,
      marker: marker
    });
  }
};

/**
 * The mouse leaves a marker : hide the tooltip
 * @param {MouseEvent} e
 * @private
 */
PSVHUD.prototype._onMouseLeave = function(e) {
  var marker;
  if (e.target && (marker = e.target.psvMarker)) {
    // do not hide if we enter the tooltip itself while hovering a polygon
    if (marker.isPolygon() && e.relatedTarget && PSVUtils.hasParent(e.relatedTarget, this.psv.tooltip.container)) {
      return;
    }

    this.hoveringMarker = null;

    this.psv.tooltip.hideTooltip();
  }
};

/**
 * The mouse hovers a polygon marker, the tooltip follow the cursor.
 * @param {MouseEvent} e
 * @private
 */
PSVHUD.prototype._onMouseMove = function(e) {
  if (!this.psv.prop.moving) {
    var marker;
    // do not hide if we enter the tooltip while hovering a polygon
    if (e.target && (marker = e.target.psvMarker) && marker.tooltip && marker.isPolygon() ||
      e.target && PSVUtils.hasParent(e.target, this.psv.tooltip.container) && (marker = this.hoveringMarker)) {

      this.hoveringMarker = marker;

      var boundingRect = this.psv.container.getBoundingClientRect();

      // simulate a marker with the size of the tooltip arrow to separate it from the cursor
      this.psv.tooltip.showTooltip({
        content: marker.tooltip.content,
        position: marker.tooltip.position,
        top: e.clientY - boundingRect.top - this.psv.config.tooltip.arrow_size / 2,
        left: e.clientX - boundingRect.left - this.psv.config.tooltip.arrow_size,
        marker: {
          width: this.psv.config.tooltip.arrow_size * 2,
          height: this.psv.config.tooltip.arrow_size * 2
        }
      });
    }
    else if (this.hoveringMarker && this.hoveringMarker.isPolygon()) {
      this.psv.tooltip.hideTooltip();
    }
  }
};

/**
 * The mouse button is release : show/hide the panel if threshold was not reached, or do nothing
 * @param {Object} data
 * @param {Event} e
 * @private
 */
PSVHUD.prototype._onClick = function(data, e) {
  var marker;
  if (data.target && (marker = PSVUtils.getClosest(data.target, '.psv-marker')) && marker.psvMarker) {
    this.currentMarker = marker.psvMarker;
    this.psv.trigger('select-marker', marker.psvMarker);

    if (this.psv.config.click_event_on_marker) {
      // add the marker to event data
      data.marker = marker.psvMarker;
    }
    else {
      e.stopPropagation();
    }
  }
  else if (this.currentMarker) {
    this.psv.trigger('unselect-marker', this.currentMarker);
    this.currentMarker = null;
  }

  if (marker && marker.psvMarker && marker.psvMarker.content) {
    this.psv.panel.showPanel(marker.psvMarker.content);
  }
  else if (this.psv.panel.prop.opened) {
    e.stopPropagation();
    this.psv.panel.hidePanel();
  }
};
