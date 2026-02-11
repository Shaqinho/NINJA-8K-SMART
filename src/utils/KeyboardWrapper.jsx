import React from 'react';
import KeyboardExtended from './KeyboardExtended';
import NinjaKeyboardCompact from './NinjaKeyboard';

const KeyboardWrapper = (props) => {
  const selectedKeyboard = localStorage.getItem('ninja_keyboard_type') || 'extended';

  switch (selectedKeyboard) {
    case 'ninja':
      return <NinjaKeyboardCompact {...props} />;
    case 'extended':
    default:
      return <KeyboardExtended {...props} />;
  }
};

export default KeyboardWrapper;
