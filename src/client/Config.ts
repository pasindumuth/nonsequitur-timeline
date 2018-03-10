export default class Config {

    /**
     * Canvas parameters
     */
    static RIBBON_HEIGHT: number = 6;
    static THREAD_TIMELINE_GAP: number = 20;
    static PROGRAM_TIMELINE_TOP_PADDING: number = 15;
    static PROGRAM_TIMELINE_BOTTOM_PADDING: number = 10;
    static PROGRAM_TIMELINE_LEFT_PADDING: number = 100;
    static PROGRAM_TIMELINE_RIGHT_PADDING: number = 55;
    static CANVAS_MARGIN: number = 50;

    static TIMELINE_MEASURE_BAR_HEIGHT: number = 25;
    static TIMELINE_MEASURE_BAR_LEFT_OVERFLOW: number = 40;
    static TIMELINE_MEASURE_BAR_TOP_PADDING: number = 10;
    static TIMELINE_MEASURE_BAR_BOTTOM_PADDING: number = 10;
    static TIMELINE_MEASURE_BAR_LINE_HEIGHT: number = 15;
    static TIMELINE_MEASURE_BAR_COLOR: string = "#eaeaea";
        
    static TARGET_NOTCH_LENGTH: number = 500;
    static TIMELINE_MEASURE_BAR_NOTCH_WIDTH: number = 1;
    static TIMELINE_MEASURE_BAR_NOTCH_HEIGHT: number = Config.TIMELINE_MEASURE_BAR_LINE_HEIGHT;
    static NOTCH_COLOR: string = "#888888";
    static TIMELINE_MEASURE_BAR_STRING_FONT: string = "Arial";
    static TIMELINE_MEASURE_BAR_STRING_FONT_SIZE: number = 10;
    static TIMELINE_MEASURE_BAR_STRING_FONT_COLOR: string = "#000000";

    static NAME_SIDE_BAR_LEFT_OFFSET: number = Config.TIMELINE_MEASURE_BAR_LEFT_OVERFLOW;
    static NAME_FONT: string = "Arial";
    static NAME_FONT_SIZE: number = 15;
    static NAME_FONT_COLOR: string = "#000000";

    static RIBBON_LIGHT = "#eaeaea";
    static RIBBON_DARK = "#f4f4f4";

    /**
     * Other
     */

    static MAX_SAMPLE_INTERVAL_SIZE = 100000000;

    static ALL_COLORS = ["#969664","#fa0064","#9632c8","#3264fa","#966464","#32c864","#fa6496",
    "#6432c8","#c864c8","#96c896","#c800c8","#fa3232","#64fa64","#6432fa","#00fafa","#00c8fa",
    "#0032fa","#00fac8","#32c896","#3200fa","#fa9696","#643296","#64fac8","#96fa64","#fa6432",
    "#64c800","#6400fa","#96fa00","#9600c8","#6496c8","#0064fa","#32c8fa","#6464c8","#32fafa",
    "#00fa64","#fafa96","#fa64fa","#c8fa96","#c8c8fa","#00fa32","#c832fa","#c83264","#c8c832",
    "#fafac8","#64c864","#00fa96","#fac832","#32c832","#fa3296","#00c8c8","#c80064","#fafa32",
    "#96c8c8","#3296c8","#32fa96","#fa0096","#009696","#9632fa","#64fa96","#c8c864","#c86400",
    "#c896fa","#fa32fa","#c8fa64","#329664","#963296","#c89696","#96fafa","#32fa32","#96c8fa",
    "#c89664","#963264","#fa9600","#6400c8","#96fa32","#c86432","#64fafa","#9600fa","#fa3200",
    "#fa9632","#32fac8","#96c800","#c8fa32","#c83296","#c8fafa","#c896c8","#fa6464","#96fac8",
    "#646464","#c800fa","#fac8fa","#32fa64","#fa96fa","#fafa00","#6496fa","#969600","#c83232",
    "#fa64c8","#64c8c8","#fa9664","#96fa96","#0064c8","#64fa00","#64c8fa","#c864fa","#fa32c8",
    "#969696","#3232c8","#fafa64","#329696","#96c832","#00c896","#64c832","#c8fa00","#966432",
    "#960096","#c86464","#fac800","#966496","#969632","#6464fa","#c8fac8","#32c8c8","#fa00c8",
    "#3232fa","#9664c8","#c8c800","#3264c8","#fa96c8","#9696fa","#fa3264","#fac864","#fa00fa",
    "#646496","#64fa32","#0096c8","#649664","#326496","#649632"];
}
