/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2004-2008 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Sebastian Werner (wpbasti)
     * Fabian Jakobs (fjakobs)

************************************************************************ */

/**
 * A full featured horizontal box layout. It lays out widgets in a
 * horizontal row, from left to right.
 *
 * Other names (for comparable layouts in other systems):
 *
 * * QHBoxLayout (Qt)
 * * StackPanel (XAML)
 * * RowLayout (SWT) (with wrapping support like a FlowLayout)
 *
 * Supports:
 *
 * * Integer dimensions (using widget properties)
 * * Additional percent width (using layout property)
 * * Min and max dimensions (using widget properties)
 * * Priorized growing/shrinking (flex) (using layout properties)
 * * Left and right margins (even negative ones) with margin collapsing support (using layout properties)
 * * Auto sizing
 * * Horizontal align
 * * Horizontal spacing
 * * Reversed children ordering
 */
qx.Class.define("qx.ui2.layout.HBox",
{
  extend : qx.ui2.layout.Abstract,






  /*
  *****************************************************************************
     PROPERTIES
  *****************************************************************************
  */

  properties :
  {
    /** Spacing between two children */
    spacing :
    {
      check : "Integer",
      init : 5,
      apply : "_applyLayoutChange"
    },


    /** Horizontal alignment of the whole children block */
    align :
    {
      check : [ "left", "center", "right" ],
      init : "left",
      apply : "_applyLayoutChange"
    },


    /** Whether the actual children data should be reversed for layout (right-to-left) */
    reversed :
    {
      check : "Boolean",
      init : false,
      apply : "_applyLayoutChange"
    }
  },





  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    /*
    ---------------------------------------------------------------------------
      LAYOUT INTERFACE
    ---------------------------------------------------------------------------
    */

    // overridden
    renderLayout : function(availWidth, availHeight)
    {
      // Cache children
      var children = this._children;
      var length = children.length;

      if (this.getReversed())
      {
        var start = length;
        var end = 0;
        var increment = -1;
      }
      else
      {
        var start = 0;
        var end = length;
        var increment = 1;
      }



      // **************************************
      //   Caching children data
      // **************************************

      // First run to cache children data and compute allocated width
      var child;
      var widths = [];
      var gaps = this._getGaps();
      var percentWidth;

      for (var i=start; i!=end; i+=increment)
      {
        child = children[i];
        percentWidth = this.getLayoutProperty(child, "width");

        widths[i] = percentWidth ?
          Math.floor((availWidth - gaps) * parseFloat(percentWidth) / 100) :
          child.getSizeHint().width;
      }

      var allocatedWidth = qx.lang.Array.sum(widths) + gaps;

      // this.debug("Initial widths: avail=" + availWidth + ", allocatedWidth=" + allocatedWidth);




      // **************************************
      //   Flex support (growing/shrinking)
      // **************************************

      if (allocatedWidth != availWidth)
      {
        var flexibles = [];
        var grow = allocatedWidth < availWidth;
        var flex;

        for (var i=start; i!=end; i+=increment)
        {
          child = children[i];

          if (child.canStretchX())
          {
            flex = this.getLayoutProperty(child, "flex", 0);
            hint = child.getSizeHint();

            if (flex > 0)
            {
              flexibles.push({
                id : i,
                potential : grow ? hint.maxWidth - hint.width : hint.width - hint.minWidth,
                flex : grow ? flex : 1 / flex
              });
            }
          }
        }

        if (flexibles.length > 0)
        {
          var flexibleOffsets = qx.ui2.layout.Util.computeFlexOffsets(flexibles, availWidth - allocatedWidth);

          for (var key in flexibleOffsets) {
            widths[key] += flexibleOffsets[key];
          }

          // Update allocated width
          allocatedWidth = qx.lang.Array.sum(widths) + gaps;
        }
      }

      // this.debug("Corrected widths: avail=" + width + ", used=" + allocatedWidth);



      // **************************************
      //   Alignment support
      // **************************************

      var left = 0;
      if (allocatedWidth < availWidth && this.getAlign() != "left")
      {
        left = availWidth - allocatedWidth;

        if (this.getAlign() === "center") {
          left = Math.round(left / 2);
        }
      }




      // **************************************
      //   Layouting children
      // **************************************

      var prev, hint, top, height, width, marginEnd, marginStart;
      var spacing = this.getSpacing();
      var util = qx.ui2.layout.Util;

      for (var i=start; i!=end; i+=increment)
      {
        child = children[i];

        // Compute left position of this child
        if (left < availWidth)
        {
          if (i === start)
          {
            left += this.getLayoutProperty(child, "marginLeft", 0);
          }
          else
          {
            // "prev" is the previous child from the previous interation
            marginEnd = this.getLayoutProperty(prev, "marginRight", 0);
            marginStart = this.getLayoutProperty(child, "marginLeft", 0);

            // "width" is still the width of the previous child
            left += width + spacing + util.collapseMargins(marginEnd, marginStart);
          }
        }

        // Detect if the child is still (partly) visible
        if (left < availWidth)
        {
          hint = child.getSizeHint();
          if (child.canStretchY()) {
            height = Math.max(hint.minHeight, Math.min(availHeight, hint.height));
          } else {
            height = hint.height;
          }

          // Respect vertical alignment
          top = util.computeVerticalAlignOffset(this.getLayoutProperty(child, "align", "top"), height, availHeight);

          // Load width
          width = widths[i];

          // Layout child
          child.renderLayout(left, top, width, height);

          // Include again (if excluded before)
          child.include();

          // Remember previous child
          prev = child;
        }
        else
        {
          // Exclude (completely) hidden children
          child.exclude();
        }
      }
    },


    // overridden
    _computeSizeHint : function()
    {
      // Read children
      var children = this._children;
      var length = children.length;

      if (this.getReversed())
      {
        var start = length;
        var end = 0;
        var increment = -1;
      }
      else
      {
        var start = 0;
        var end = length;
        var increment = 1;
      }

      // Initialize
      var minWidth=0, width=0;
      var minHeight=0, height=0;
      var hint;

      // Iterate over children
      for (var i=0; i!=end; i+=increment)
      {
        hint = children[i].getSizeHint();

        // Sum up widths
        width += hint.width;
        minWidth += hint.minWidth;

        // Find maximum heights
        if (hint.height > height) {
          height = hint.height;
        }

        if (hint.minHeight > minHeight) {
          minHeight = hint.minHeight;
        }
      }

      // Respect gaps
      var gaps = this._getGaps();

      // Return hint
      return {
        minWidth : minWidth + gaps,
        width : width + gaps,
        maxWidth : Infinity,
        minHeight : minHeight,
        height : height,
        maxHeight : Infinity
      };
    },







    /*
    ---------------------------------------------------------------------------
      LAYOUT HELPERS
    ---------------------------------------------------------------------------
    */

    /**
     * Computes the spacing sum plus margin. Supports margin collapsing.
     *
     * @type member
     * @return {void}
     */
    _getGaps : function()
    {
      var util = qx.ui2.layout.Util;

      // Cache children data
      var children = this._children;
      var length = children.length;
      if (this.getReversed()) {
        children = children.concat().reverse();
      }

      // Initialize gaps
      var gaps = this.getSpacing() * (length - 1);

      // Add margin left of first child (no collapsing here)
      gaps += this.getLayoutProperty(children[0], "marginLeft", 0);

      // Add inner margins (with collapsing support)
      if (length > 0)
      {
        var marginEnd, marginStart;

        // Ignore last child here (will be added later)
        for (var i=0; i<length-1; i++)
        {
          marginEnd = this.getLayoutProperty(children[i], "marginRight", 0);
          marginStart = this.getLayoutProperty(children[i+1], "marginLeft", 0);

          gaps += util.collapseMargins(marginEnd, marginStart);
        }
      }

      // Add margin right of last child (no collapsing here)
      gaps += this.getLayoutProperty(children[length-1], "marginRight", 0);

      return gaps;
    }
  }
});
