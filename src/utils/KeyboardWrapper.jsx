import React from 'react';
import Keyboard_Extended from './Keyboard_Extended';
import NinjaKeyboard_Compact from './NinjaKeyboard';

const KeyboardWrapper = (props) => {
  const selectedKeyboard = localStorage.getItem('ninja_keyboard_type') || 'extended';

  switch (selectedKeyboard) {
    case 'ninja':
      return <NinjaKeyboard_Compact {...props} />;
    case 'extended':
    default:
      return <Keyboard_Extended {...props} />;
  }
};

export default KeyboardWrapper;
