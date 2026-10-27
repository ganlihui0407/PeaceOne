import TextInput from './TextInput.jsx'

function SearchInput({ type = 'search', ...props }) {
  return <TextInput type={type} {...props} />
}

export default SearchInput
