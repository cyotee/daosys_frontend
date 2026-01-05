import React, { FC, useCallback, useState, useMemo, useEffect } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Divider, FormControl, FormControlLabel, Grid, Switch, TextField, Typography } from "@mui/material";
import { AbiFunction } from "abitype";
import Button from "@/components/Button";
import TabMethodOptions from "./TabMethodOptions";
import TabMethodEvents from "./TabMethodEvents";
import { ArrowRight, ExpandMore, ExpandOutlined } from "@mui/icons-material";
import { Box as CustomBox } from "@/components/Box";
import { AbiEncoder } from "@/components/AbiEncoder";
import { useHistory } from "../../history/hooks/useHistory";
import { debugLog } from "@/utils/debug";


export type TabMethodProps = {
    details: AbiFunction;
    displayName?: string;
    contractListMeta?: any;
    onCall: (
        params: { [key: string]: any },
        stateSetCallback: React.Dispatch<React.SetStateAction<{ [key: string]: string; }>>,
        setErrorCallback: React.Dispatch<React.SetStateAction<string>>,
        setTxHash: React.Dispatch<React.SetStateAction<string | undefined>>,
        staticCall: boolean,
        options?: { [key: string]: string | number | bigint },
    ) => void;
};

export const TabMethod: FC<TabMethodProps> = ({ details, onCall, displayName, contractListMeta }) => {

    // Initialize the inputs state based on the details.inputs
    const initialInputs = useMemo(() => {
        return details.inputs.reduce((acc, param) => {
            const key = param.name as string;
            acc[key] = '';
            return acc;
        }, {} as { [key: string]: any });
    }, [details.inputs]);



    const [results, setResults] = useState<{ [key: string]: string }>({});
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [options, setOptions] = useState<{ [key: string]: string | number | bigint }>({});
    const [inputs, setInputs] = useState(initialInputs);

    const [txHash, setTxHash] = useState<string | undefined>(undefined);

    const [staticCall, setStaticCall] = useState<boolean>(false);


    const handleCallProxy = useCallback(() => {
        onCall(inputs, setResults, setErrorMessage, setTxHash, staticCall, options);
    }, [onCall, inputs, staticCall, options]);

    const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setStaticCall(event.target.checked);
    }


    // Updated onChange handler to use a function inside setState
    // to ensure we are working with the latest state
    const handleInputChange = (name: string, value: string) => {
        setInputs((prevInputs) => ({
            ...prevInputs,
            [name]: value,
        }));
    };

    const argumentUiByName = useMemo(() => {
        const ui: Record<string, any> = {};
        const args = contractListMeta?.arguments;
        if (!Array.isArray(args)) return ui;

        for (const arg of args) {
            if (arg && typeof arg === 'object') {
                // group form: { group, fields: [...] }
                if (Array.isArray(arg.fields)) {
                    for (const f of arg.fields) {
                        if (f?.name) ui[String(f.name)] = f.ui || {};
                    }
                } else if (arg.name) {
                    ui[String(arg.name)] = arg.ui || {};
                }
            }
        }
        return ui;
    }, [contractListMeta]);

    const handleOptionsUpdate = (newOptions: { [key: string]: string | number | bigint }) => {
        const repaceOptions = ({
            ...options, ...newOptions
        });

        const filteredOptions = Object.keys(repaceOptions).reduce((acc, key) => {
            if (repaceOptions[key] !== '') {
                acc[key] = repaceOptions[key];
            }
            return acc;
        }, {} as { [key: string]: string | number | bigint });

        setOptions(filteredOptions);
    }


    return (
        <Accordion

        >
            <AccordionSummary
                expandIcon={<ExpandMore />}
            >
                <Grid container>
                    <Grid item xs={10}>
                        <Box component={'span'} sx={{
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <ArrowRight sx={{
                                mr: 2,
                            }} />
                            <Typography variant="h6">
                                {displayName || details.name}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </AccordionSummary>
            <AccordionDetails>
                <CustomBox>
                    <Box>
                        <Typography textAlign={'center'} variant="h6">
                            Call method
                        </Typography>
                    </Box>

                    <Divider />

                    {details.inputs.length > 0 && details.inputs.map((param, index) => {
                        const ui = argumentUiByName[param.name as string] || {};
                        const widget = ui.widget;
                        const placeholder = ui.placeholder;
                        const helpText = ui.helpText;
                        const isBool = String(param.type).trim() === 'bool';
                        return (
                            <Box component="div" key={index} sx={{
                                mb: 2,
                            }}>
                                <Typography variant="body1" sx={{
                                    mb: 2,
                                    fontWeight: 'bold',
                                }}>
                                    {param.name} ({param.type})
                                </Typography>
                                {helpText ? (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                        {helpText}
                                    </Typography>
                                ) : null}

                                {(widget === 'checkbox' || isBool) ? (
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={Boolean(inputs[param.name as string]) && String(inputs[param.name as string]).toLowerCase() !== 'false'}
                                                onChange={(e) => {
                                                    setInputs((prev) => ({
                                                        ...prev,
                                                        [param.name as string]: e.target.checked,
                                                    }));
                                                }}
                                            />
                                        }
                                        label={placeholder || ''}
                                    />
                                ) : (
                                    <TextField
                                        key={index}
                                        variant="outlined"
                                        value={inputs[param.name as string]}
                                        placeholder={placeholder}
                                        onChange={(e) => {
                                            handleInputChange(param.name as string, e.target.value);
                                        }}
                                    />
                                )}
                                <AbiEncoder onResultCallback={(result) => {
                                    debugLog(result);
                                    handleInputChange(param.name as string, result);
                                }}
                                    onOpen={() => {
                                        debugLog('open');
                                    }}
                                    onClose={() => {
                                        debugLog('close');
                                    }}
                                />

                            </Box>
                        );
                    })}

                    <Grid container sx={{
                        mt: 3
                    }}>
                        <Grid item xs={8}>
                            <Button neon onClick={handleCallProxy}>
                                Execute
                            </Button>
                        </Grid>
                        <Grid item xs={2}>
                            <FormControlLabel
                                control={
                                    <Switch onChange={handleSwitchChange}
                                        checked={staticCall}
                                    />
                                }

                                label="Static"
                            />

                        </Grid>
                        <Grid item xs={2} sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                        }}>
                            <TabMethodOptions onUpdate={(options) => {
                                handleOptionsUpdate(options);
                            }} changed={Object.keys(options).length > 0} initialValues={options} />
                        </Grid>
                    </Grid>

                </CustomBox>


                {Object.keys(results).length > 0 && (
                    <CustomBox
                        sx={{
                            mt: 2,
                        }}
                    >
                        <Typography variant="h6">
                            Results
                        </Typography>
                        {Object.keys(results).map((key, index) => {
                            return (
                                <Typography key={index} variant="body1">
                                    {key}: {results[key]}
                                </Typography>
                            );
                        })}
                    </CustomBox>
                )}

                {errorMessage && (
                    <Box sx={{
                        mt: 2,
                        mb: 2,
                        backgroundColor: (theme) => theme.palette.error.main,
                        padding: 2,
                        color: (theme) => theme.palette.error.contrastText,
                    }}>
                        <Typography variant="h6">
                            Error
                        </Typography>
                        <Typography variant="body1">
                            {errorMessage}
                        </Typography>
                    </Box>
                )}

                {txHash && <TabMethodEvents txHash={txHash} />}
            </AccordionDetails>
        </Accordion>
    );
};
