import { LightningElement } from 'lwc';

export default class SampleForm extends LightningElement {
    isMultiEntry = true;
    limit = 20;

    lookupRecord(event){
        console.log('lookupRecord')
        console.log(JSON.parse(JSON.stringify(event.detail)))
    }

    successHandler(event){
        console.log('record id' + event.detail.id);
    }
}