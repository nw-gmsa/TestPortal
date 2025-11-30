import {Component, Input, OnInit} from '@angular/core';
import {TdDigitsPipe} from '@covalent/core/common';
import {Bundle, Observation} from 'fhir/r4';
import {FhirService} from '../../../services/fhir.service';
import {TdLoadingService} from "@covalent/core/loading";
import {Moment} from "moment";
import * as moment from 'moment';
import {EprService} from "../../../services/epr.service";
// import {curveCardinal} from "d3-shape";
/// import {curveLinear} from "d3-shape";
import {curveCardinal} from "d3-shape";
import {DialogService} from "../../../services/dialog.service";


@Component({
  selector: 'app-observation-chart',
  templateUrl: './observation-chart.component.html',
  styleUrls: ['./observation-chart.component.scss']
})
export class ObservationChartComponent implements OnInit {

  @Input()
  patentId: string ='';

  @Input()
  showGrid = false;

  @Input()
  observationCode: string ='';

  @Input()
  title = 'Observation Chart';

  @Input()
  showRange = false;

  showXAxis = true;
  showYAxis = true;
  gradient = true;
  @Input()
  showLegend = true;
  showXAxisLabel = true;
  xAxisLabel = '';
  showYAxisLabel = true;
  timeline = false;
  yAxisLabel: string = 'Value';
  animations = false;

  colorScheme: any = {
    domain: ['#1565C0', '#03A9F4', '#FFA726', '#FFCC80'],
  };

  // line, area
  autoScale = true;

  multi: any[] = [];
  view: any = [700,200];
  observations: Observation[] = [];
  maxScale: any;
  minScale: any;
  selectedValue: number = 264;
  @Input()
  startDate: Moment = moment(new Date());
  @Input()
  endDate: Moment = moment(new Date());

  // https://github.com/d3/d3-shape#curves
  curve = curveCardinal.tension(0.5)
  referencelines: any[] = [];
  showRefLines = false;
  constructor(public fhirService: FhirService,
              private eprService: EprService,
              private dlgSrv: DialogService,
              private _loadingService: TdLoadingService) {
  }

  ngOnInit(): void {
    this.endDate = moment(this.fhirService.getToDate())
    const end = this.endDate?.toDate()
    const temp = end?.setMonth(end.getMonth() - (this.selectedValue) );
    this.startDate = moment(new Date(temp))
    this.refreshResult();
    this.eprService.endRange.subscribe(end => {
      this.endDate = end;
      this.refreshResult()
    })
    this.eprService.startRange.subscribe(start => {
      this.startDate = start;
      this.refreshResult()
    })
  }

  refreshResult(): void {
      const end = this.endDate;
    const from = this.startDate
    console.log(from)
      console.log(end)
      this.maxScale = end.toDate();
    this.minScale = from.toDate();
    this.observations = [];

    if (end !== undefined && from !== undefined) {
      this._loadingService.register('overlayStarSyntax');
      this.fhirService.get('/Observation?patient=' + this.patentId + '&code=' + this.observationCode
          + '&date=gt' + this.dlgSrv.getFHIRDateString(from.toDate()).split('T')[0]
          + '&date=lt' + this.dlgSrv.getFHIRDateString(end.toDate()).split('T')[0]
          + '&_count=400'
            + '&_sort=-date').subscribe(
          bundle => {
            //   console.log(bundle);
            const observations: Bundle = bundle as Bundle;
            let isComponent = false;

            this.yAxisLabel = 'Value';
            const multiNew: any[] = [];
            this._loadingService.resolve('overlayStarSyntax');
            if (observations.entry !== undefined && observations.entry.length > 0) {

              // Attempt to set up the series. This is not that robust

              const firstObservation = observations.entry[0].resource as Observation;
              let label = "Unknown";
              if (firstObservation.code !== undefined) {
                if (firstObservation.code.text !== undefined) label = firstObservation.code.text
                if (firstObservation.code.coding !== undefined && firstObservation.code.coding.length > 0 && firstObservation.code.coding[0].display !== undefined) {
                  label = firstObservation.code.coding[0].display
                }
              }
              if (firstObservation.valueQuantity !== undefined) {
                // @ts-ignore
                this.yAxisLabel = firstObservation.valueQuantity.unit;

                // @ts-ignore
                multiNew.push({name: label, series: [],
                });
              }
              // For components use definitions in resource
              if (firstObservation.component !== undefined) {
                // @ts-ignore
                this.yAxisLabel = firstObservation.component[0].valueQuantity.unit;
                isComponent = true;
                for (const component of firstObservation.component) {
                  // @ts-ignore
                  multiNew.push({name: component.code.coding[0].display, series: []});
                }
              }
              if (this.isFindingsCode(this.observationCode)) {
                this.yAxisLabel = 'Avg Hear Rate';
                multiNew.push(
                    {
                      name: 'Asleep',
                      series: [],
                    },
                    {
                      name: 'Exercise',
                      series: [],
                    }
                );
              }

              // console.log(multi);

              for (const entry of observations.entry) {

                if (entry.resource !== undefined && entry.resource.resourceType === 'Observation') {
                  const observation: Observation = entry.resource as Observation;
                  // populate grid view
                  this.observations.push(observation);

                  if (observation.valueQuantity !== undefined && observation.valueQuantity.value !== undefined) {
                    if (observation.effectiveDateTime !== undefined) {
                      //    console.log(observation.effectiveDateTime);
                      multiNew[this.getSeriesNum(observation)].series.push({
                        value: observation.valueQuantity.value,
                        name: new Date(observation.effectiveDateTime)
                      });
                    }
                    if (observation.effectivePeriod !== undefined) {
                      //    .log(observation.effectivePeriod.start);
                      // @ts-ignore
                      multiNew[this.getSeriesNum(observation)].series.push({value: observation.valueQuantity.value, name: new Date(observation.effectivePeriod.end)
                      });
                    }
                  }
                  if (observation.component !== undefined && observation.component.length > 0) {
                    for (const component of observation.component) {

                      let seriesId;
                      let cont = 0;
                      for (; cont < multiNew.length; cont++) {
                        // @ts-ignore
                        if (multiNew[cont].name === component.code.coding[0].display) {
                          seriesId = cont;
                        }
                      }
                      if (seriesId !== undefined) {
                        if (observation.effectiveDateTime !== undefined) {
                          const vl = component.valueQuantity?.value;
                          if (vl !== undefined) {
                            multiNew[seriesId].series.push({
                              value: vl,
                              name: new Date(observation.effectiveDateTime)
                            });
                          }
                        }
                        if (observation.effectivePeriod !== undefined) {

                          // @ts-ignore
                          multiNew[seriesId].series.push({value: component.valueQuantity.value, name: new Date(observation.effectivePeriod.end)
                          });
                        }
                      }
                    }
                  }
                }


              }

              this.referencelines = [];
              if ((multiNew.length==1 || this.observationCode=== '444981005'
                  || this.observationCode=== '40443-4'
                  || this.observationCode=== '66440-9'
              ) && multiNew.length > 0) {
                this.getReferenceLines(multiNew,0)
              } else {
                if (isComponent) {
                  for(const series in multiNew) {
                    console.log(series)
                    this.getReferenceLines(multiNew,Number(series))
                  }
                }
              }
              this.multi = multiNew;

              //    console.log(this.multi);

            }
          }
      );
    }
  }

  getReferenceLines(multiNew: any[], series: number ) {
    if (multiNew[0].series.length > 0)
    {
      this.showRefLines = true;
      let mean = 0
      multiNew[series].series.forEach(((res: any) => {
        mean += res.value
      }))
      mean = mean / multiNew[series].series.length
      let sumSq = 0
      multiNew[series].series.forEach(((res: any) => {
        sumSq += (res.value - mean) ** 2
      }))
      sumSq = Math.sqrt(sumSq / multiNew[series].series.length)
      this.referencelines.push({
        name: 'Average',
        value: (mean)
      })
      this.referencelines.push({
        name: '+',
        value: (mean + sumSq)
      })
      this.referencelines.push({
        name: '-',
        value: (mean - sumSq)
      })
    }
  }

  getSeriesNum(observation: Observation): number {
    if (observation.code !== undefined && observation.code.coding !== undefined && observation.code.coding.length > 0) {
      if (observation.effectiveDateTime !== undefined || observation.effectivePeriod !== undefined) {
        if (this.isFindingsObsevation(observation)) {
          if (observation.extension !== undefined) {
            for(const extension of observation.extension) {

              if (extension.url === 'http://hl7.org/fhir/us/vitals/StructureDefinition/SleepStatusExt') {
                if (extension.valueCodeableConcept !== undefined && extension.valueCodeableConcept.coding !== undefined) {

                  if (extension.valueCodeableConcept.coding[0].code === '248220008') {

                    return 1;
                  }
                }
              }
              if (extension.url === 'http://example.fhir.nhs.uk/StructureDefinition/MeasurementSettingExt') {
                if (extension.valueCodeableConcept !== undefined && extension.valueCodeableConcept.coding !== undefined) {

                  if (extension.valueCodeableConcept.coding[0].code === '272501009') {

                    return 2;
                  }
                }
              }
            }
          }
        }
      }
    }
    return 0;
  }
  isFindingsObsevation(observation: Observation): boolean {
    if (observation.code.coding !== undefined && observation.code.coding.length > 0
      && observation.code.coding[0].code !== undefined ) {
      return this.isFindingsCode(observation.code.coding[0].code)
    }
    return false;
  }
  isFindingsCode(obsCode: string): boolean {
    if (obsCode === '66440-9') {
      return true;
    }
    if (obsCode === '55424-6') {
      return true;
    }
    if (obsCode === '40443-4' || obsCode === '444981005') {
      return true;
    }
    return false;
  }
  axisDigits(val: any): any {
    return new TdDigitsPipe().transform(val);
  }

  change(num: number): void {

    this.refreshResult();
  }

    getStyle() {
        if (!this.showGrid) return "height: 150px"
      return "height: 400px"
    }

  selected(event: any) {

    const end = this.endDate?.toDate()
    const temp = end?.setMonth(end.getMonth() - (this.selectedValue) );
    this.startDate = moment(new Date(temp))
    this.refreshResult();

  }


  functionStartName() {

    if ((this.startDate.toDate() > this.endDate.toDate()) && this.selectedValue !== undefined) {
      const start = this.startDate?.toDate()
      const temp = start?.setMonth(start.getMonth() + (this.selectedValue) );
      this.endDate = moment(new Date(temp))
    }
    this.refreshResult()
  }
  functionEndName() {

    if ((this.startDate.toDate() > this.endDate.toDate()) && this.selectedValue !== undefined) {
      const end = this.endDate?.toDate()
      const temp = end?.setMonth(end.getMonth() - (this.selectedValue) );
      this.startDate = moment(new Date(temp))
    }
    this.refreshResult()
  }
}
