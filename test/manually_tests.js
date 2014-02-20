(function($) {
    var $item = $('#t1 > .tl-item');
    var $target = $('#t1 > .tl-green-box');
    var $draggable = $("#t1 > .tl-green-box");
    var calculatorOptions = {
        item: $item,
        target: $target,
        boundary: "#t1",
        itemAt: "top right",
        itemOffset: { y: 0, x: 0, mirror: false },
        targetAt: "top left",
        targetOffset: { y: 0, x: 0, mirror: false },
        stick: "none",
        flip: "none"
    };
    var calculator = null;

    var $itemTop        = $('#itemTop');
    var $itemLeft       = $('#itemLeft');
    var $targetTop      = $('#targetTop');
    var $targetLeft     = $('#targetLeft');
    var $difX           = $('#difX');
    var $difY           = $('#difY');

    var $moveByX        = $('#moveByX');
    var $moveByY        = $('#moveByY');
    var $overflow       = $('#overflow');
    var $distanceTop    = $('#distanceTop');
    var $distanceLeft   = $('#distanceLeft');
    var $distanceBottom = $('#distanceBottom');
    var $distanceRight  = $('#distanceRight');

    function showValues(data) {

        var item_offset = $item.offset();
        var ta_offset = $target.offset();

        $itemTop.text(item_offset.top);
        $itemLeft.text(item_offset.left);
        if(ta_offset) {
            //window and document have no offset
            $targetTop.text(ta_offset.top);
            $targetLeft.text(ta_offset.left);
            $difX.text(item_offset.left - ta_offset.left);
            $difY.text(item_offset.top - ta_offset.top);
        } else {
            $targetTop.text("-");
            $targetLeft.text("-");
            $difX.text("-");
            $difY.text("-");
        }

        data = data || calculator.calculate();
        $moveByX.text(data.moveBy.x);
        $moveByY.text(data.moveBy.y);
        if(data.distance) {
            $overflow.text(data.distance.overflow || "null");
            $distanceTop.text(data.distance.top);
            $distanceLeft.text(data.distance.left);
            $distanceBottom.text(data.distance.bottom);
            $distanceRight.text(data.distance.right);
        } else {
            $overflow.text("-");
            $distanceTop.text("-");
            $distanceLeft.text("-");
            $distanceBottom.text("-");
            $distanceRight.text("-");
        }
    }


    function onUpdateOptions(e) {
        calculatorOptions.target = $('#sel_target').val();

        $target.removeClass("tl-marker");
        if(calculatorOptions.target === "window") {
            $target = $(window);
        } else if(calculatorOptions.target === "document") {
            $target = $(document);
        } else {
            $target = $(calculatorOptions.target);
        }
        $target.addClass("tl-marker");

        calculatorOptions.boundary = $('#sel_boundary').val();

        calculatorOptions.itemAt = $('#sel_item_at_y').val() + ' ' + $('#sel_item_at_x').val();
        calculatorOptions.itemOffset.y = $('#tx_itemAt_offset_y').val();
        calculatorOptions.itemOffset.x = $('#tx_itemAt_offset_x').val();
        calculatorOptions.itemOffset.mirror = $('#cb_itemAt_offset_m')[0].checked;

        calculatorOptions.targetAt = $('#sel_tar_at_y').val() + ' ' + $('#sel_tar_at_x').val();
        calculatorOptions.targetOffset.y = $('#tx_tarAt_offset_y').val();
        calculatorOptions.targetOffset.x = $('#tx_tarAt_offset_x').val();
        calculatorOptions.targetOffset.mirror = $('#cb_tarAt_offset_m')[0].checked;

        calculatorOptions.stick = $('#sel_stick').val();
        calculatorOptions.flip = $('#sel_flip').val();

        calculator = new $.PositionCalculator(calculatorOptions);

        updateElement(e);
    }

    function updateElement(e, data) {

        data = data || calculator.calculate();

        //set corner marker
        $item.removeClass("top").removeClass("right").removeClass("bottom").removeClass("left");
        $target.removeClass("top").removeClass("right").removeClass("bottom").removeClass("left");

        $item.addClass(calculatorOptions.itemAt);
        $target.addClass(calculatorOptions.targetAt);

        var matrix, currentX, currentY;

        var transform = $item.css("transform");
        if(transform && transform.indexOf('(') === 6) {
            matrix = $item.css("transform").slice('7',-1).split(',');
        }
        currentX = matrix ? parseFloat(matrix[4]) : 0;
        currentY = matrix ? parseFloat(matrix[5]) : 0;

        $item.css("transform", "translate("
            + (data.moveBy.x + currentX ) + "px,"
            + (data.moveBy.y + currentY ) + "px)"
        );

        //set reference point cornder
    }

    //event listener
    function ta_onMouseDown(e) {
        e.preventDefault();

        var ta_startOffset = $target.offset();
        var ta_mouse_offset = {
            x: e.pageX - ta_startOffset.left,
            y: e.pageY - ta_startOffset.top
        };

        $draggable.on("mousemove.tl.drag", function(e) {
            $draggable.offset( {
                left: e.pageX - ta_mouse_offset.x,
                top: e.pageY - ta_mouse_offset.y
            });
            var data = calculator.calculate();
            $draggable.trigger("tl_drag", data);
            showValues(data);
        });

        $draggable.on("mouseup.tl.drag mouseout.tl.drag", function() {
            //remove all listeners
            $draggable.off(".tl.drag");
            //add down handler
            $draggable.on("mousedown.tl.drag", ta_onMouseDown);
        });
    }

    $('#cb_follow_green').on('change.tl.test', function() {
        if(this.checked) {
            // item follows "green box"
            $('#sel_target').val("#t1 > .tl-green-box").prop("disabled", true);
            onUpdateOptions();
            $draggable.on("tl_drag.tl.follow", updateElement);
        } else {
            $draggable.off("tl_drag.tl.follow");
            $('#sel_target').prop("disabled", false);
        }
    });
    $('#options_t1').on('change.tl.test', onUpdateOptions);

    $(document).on( "tl_updateOptions.tl.test", onUpdateOptions);


    //export
    window.tl = {
        showValues : showValues
    };

    // /////////////////
    // init

    //to synchronice with cached browser settings
    onUpdateOptions();
    $('#cb_follow_green').change();
    showValues();

    //add down handler
    $draggable.on("mousedown.tl.drag", ta_onMouseDown);
    $draggable.addClass("tl-draggable");
})(jQuery);
