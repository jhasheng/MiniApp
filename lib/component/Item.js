'use strict'

// 原生组件
function Item(props) {
    return (
        <li 
            className="item"
            style={props.style}
        >
            {props.children}
            <a href="#" onClick={props.onRemoveItem}>
                x
            </a>
        </li>
    );
}

module.exports = Item;
