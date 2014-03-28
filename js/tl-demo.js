(function($) {
    var $container = $('#container1');
    var $item = $('#container1 > .tl-item');
    var $target = $('#container1 > .tl-green-box');
    var $draggable = $("#container1 > .tl-green-box");
    var $tolarge = $('#tolarge');

    var calculatorOptions = {
        item: $item,
        target: $target,
        boundary: $container,
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

    var $preResult        = $('#preRsesult');

    function showValues(data) {

        var item_offset = $item.offset();
        var ta_offset = $target.offset();

        $itemTop.text(item_offset.top);
        $itemLeft.text(item_offset.left);
        //window and document have no offset
        if(ta_offset) {
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
        $preResult.text(JSON.stringify(data, null, "  "));
    }


    function onUpdateOptions() {
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

        updateElement();
    }

    function updateElement() {

        var data = calculator.calculate();

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

        showValues(data);
    }

    //event listener
    function ta_onMouseDown(event) {
        event.preventDefault();

        var ta_startOffset = $draggable.offset();
        var ta_mouse_offset = {
            x: event.pageX - ta_startOffset.left,
            y: event.pageY - ta_startOffset.top
        };

        $draggable.on("mousemove.tl.drag", function(event) {
            $draggable.offset( {
                left: event.pageX - ta_mouse_offset.x,
                top: event.pageY - ta_mouse_offset.y
            });
            $draggable.trigger("tl_drag");
        });

        $draggable.on("mouseup.tl.drag mouseleave.tl.drag", function() {
            //remove all listeners
            $draggable.off(".tl.drag");
            //add down handler
            $draggable.on("mousedown.tl.drag", ta_onMouseDown);
        });
    }

    function addScrollbars(show) {
        if(show) {
            $tolarge.show();
            $container.css('overflow', 'auto');
        } else {
            $tolarge.hide();
            $container.css('overflow', 'visible');
        }

        calculator.resize();
        updateElement();
    }

    $('#cb_follow_green').on('change.tl.test', function() {
        if(this.checked) {
            // item follows "green box"
            $('#sel_target').val("#container1 > .tl-green-box").prop("disabled", true);
            onUpdateOptions();
            $draggable.on("tl_drag.tl.follow", updateElement);
        } else {
            $draggable.off("tl_drag.tl.follow");
            $('#sel_target').prop("disabled", false);
        }
    });
    $('#options1').on('change.tl.test', onUpdateOptions);

    //add scrollbar hide/show
    $('#cb_addScrollbar').on('change.tl.test', function() { addScrollbars(this.checked); } );
    $('#cb_addScrollhandler').on('change.tl.test', function() {
        if(this.checked) {
            $container.on('scroll.tl.test', updateElement);
        } else {
            $container.off('scroll.tl.test', updateElement);
        }
    });


    // /////////////////
    // init

    //to synchronice with cached browser settings
    onUpdateOptions();
    $('#cb_follow_green').change();
    $('#cb_addScrollbar').change();
    $('#cb_addScrollhandler').change();

    //add down handler
    $draggable.on("mousedown.tl.drag", ta_onMouseDown);
    $draggable.addClass("tl-draggable");

})(jQuery);
