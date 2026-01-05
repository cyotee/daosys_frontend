import { styled, Select as MdSelect, SelectProps as MdSelectProps } from "@mui/material";

export interface SelectProps extends MdSelectProps {

}

export const Select = styled(MdSelect)<SelectProps>(({ theme }) => ({
    backgroundColor: theme.palette.background.paper,
}));

export default Select;