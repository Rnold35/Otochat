import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input: React.FC<InputProps> = (props) => {
  return <input {...props} className={`border p-2 rounded ${props.className}`} />;
};

export default Input;
